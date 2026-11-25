package com.satlas.service;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.CalendarEventRequest;
import com.satlas.api.dto.CalendarEventResponse;
import com.satlas.api.dto.GoogleSyncResponse;
import com.satlas.entity.Assignment;
import com.satlas.entity.CalendarEvent;
import com.satlas.entity.CalendarEventSource;
import com.satlas.entity.User;
import com.satlas.repository.AssignmentRepository;
import com.satlas.repository.CalendarEventRepository;
import com.satlas.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class CalendarService {

    private static final String DEFAULT_SATLAS_COLOR = "#3b82f6";
    private static final String DEFAULT_GOOGLE_COLOR = "#10b981";

    private final CalendarEventRepository calendarEventRepository;
    private final AssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final IcalParser icalParser;
    private final RestClient restClient = RestClient.create();

    /**
     * 自分の予定＋他ユーザーの共有予定＋自分の未完了課題締切を統合して返す。
     */
    @Transactional(readOnly = true)
    public List<CalendarEventResponse> listUnified(User currentUser, LocalDateTime start, LocalDateTime end) {
        List<CalendarEvent> events = calendarEventRepository.findVisibleInRange(currentUser.getId(), start, end);
        List<Assignment> assignments = assignmentRepository
                .findByUserIdAndCompletedFalseAndDueDateBetweenOrderByDueDateAsc(currentUser.getId(), start, end);

        Set<Long> userIds = events.stream().map(CalendarEvent::getUserId).collect(Collectors.toSet());
        Map<Long, String> userNames = new HashMap<>();
        userNames.put(currentUser.getId(), currentUser.getName());
        if (!userIds.isEmpty()) {
            userRepository.findAllById(userIds).forEach(u -> userNames.put(u.getId(), u.getName()));
        }

        List<CalendarEventResponse> result = new ArrayList<>(events.size() + assignments.size());
        for (CalendarEvent e : events) {
            String owner = userNames.getOrDefault(e.getUserId(), "メンバー");
            result.add(CalendarEventResponse.fromEvent(e, currentUser.getId(), owner));
        }
        for (Assignment a : assignments) {
            result.add(CalendarEventResponse.fromAssignment(a, currentUser.getName()));
        }
        result.sort(Comparator.comparing(CalendarEventResponse::startAt));
        return result;
    }

    @Transactional
    public CalendarEventResponse create(User currentUser, CalendarEventRequest req) {
        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title は必須です");
        }
        if (req.startAt() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startAt は必須です");
        }
        boolean allDay = Boolean.TRUE.equals(req.allDay());
        LocalDateTime endAt = req.endAt() != null
                ? req.endAt()
                : (allDay ? req.startAt().plusDays(1) : req.startAt().plusHours(1));
        if (endAt.isBefore(req.startAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt は startAt 以降にしてください");
        }

        CalendarEvent e = new CalendarEvent();
        e.setUserId(currentUser.getId());
        e.setTitle(req.title().trim());
        e.setDescription(blankToNull(req.description()));
        e.setStartAt(req.startAt());
        e.setEndAt(endAt);
        e.setAllDay(allDay);
        e.setShared(Boolean.TRUE.equals(req.isShared()));
        e.setSource(CalendarEventSource.SATLAS);
        e.setColor(blankToNull(req.color()) != null ? req.color().trim() : DEFAULT_SATLAS_COLOR);

        return CalendarEventResponse.fromEvent(calendarEventRepository.save(e), currentUser.getId(), currentUser.getName());
    }

    @Transactional
    public CalendarEventResponse update(User currentUser, Long id, CalendarEventRequest req) {
        CalendarEvent e = calendarEventRepository.findByIdAndUserId(id, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "予定が見つからないか編集権限がありません"));

        if (req.title() != null) {
            if (req.title().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title を空にはできません");
            }
            e.setTitle(req.title().trim());
        }
        if (req.description() != null) {
            e.setDescription(blankToNull(req.description()));
        }
        if (req.startAt() != null) {
            e.setStartAt(req.startAt());
        }
        if (req.endAt() != null) {
            e.setEndAt(req.endAt());
        }
        if (req.allDay() != null) {
            e.setAllDay(req.allDay());
        }
        if (req.isShared() != null) {
            e.setShared(req.isShared());
        }
        if (req.color() != null) {
            e.setColor(blankToNull(req.color()));
        }
        if (e.getEndAt().isBefore(e.getStartAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endAt は startAt 以降にしてください");
        }

        return CalendarEventResponse.fromEvent(calendarEventRepository.save(e), currentUser.getId(), currentUser.getName());
    }

    @Transactional
    public void delete(User currentUser, Long id) {
        CalendarEvent e = calendarEventRepository.findByIdAndUserId(id, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "予定が見つからないか削除権限がありません"));
        calendarEventRepository.delete(e);
    }

    /**
     * ユーザーに登録された Google カレンダー iCal URL (.ics) を取得・パースして upsert する。
     * タイトルまたは説明文に {@code [共有]} または {@code #share} が含まれる場合は自動的に {@code isShared = true} にする。
     */
    @Transactional
    public GoogleSyncResponse syncGoogleIcal(User currentUser) {
        String icalUrl = currentUser.getGoogleIcalUrl();
        if (icalUrl == null || icalUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Google カレンダーの iCal URL が未設定です");
        }
        URI uri = validateIcalUri(icalUrl.trim());

        String icsBody;
        try {
            icsBody = restClient.get()
                    .uri(uri)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            log.warn("Failed to fetch Google iCal URL for user {}: {}", currentUser.getId(), e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Google カレンダー (.ics) の取得に失敗しました。URL を確認してください");
        }

        List<IcalParser.ParsedEvent> parsed = icalParser.parse(icsBody);
        int created = 0;
        int updated = 0;
        int shared = 0;

        for (IcalParser.ParsedEvent p : parsed) {
            boolean autoShare = hasShareTag(p.summary(), p.description());
            CalendarEvent event = calendarEventRepository
                    .findByUserIdAndSourceAndExternalUid(currentUser.getId(), CalendarEventSource.GOOGLE_ICAL, p.uid())
                    .orElse(null);

            if (event == null) {
                event = new CalendarEvent();
                event.setUserId(currentUser.getId());
                event.setSource(CalendarEventSource.GOOGLE_ICAL);
                event.setExternalUid(p.uid());
                event.setColor(DEFAULT_GOOGLE_COLOR);
                event.setShared(autoShare);
                created++;
            } else {
                if (autoShare) {
                    event.setShared(true);
                }
                updated++;
            }

            event.setTitle(truncate(p.summary(), 200));
            event.setDescription(blankToNull(p.description()));
            event.setStartAt(p.startAt());
            event.setEndAt(p.endAt());
            event.setAllDay(p.allDay());

            if (event.isShared()) {
                shared++;
            }
            calendarEventRepository.save(event);
        }

        return new GoogleSyncResponse(parsed.size(), created, updated, shared, LocalDateTime.now());
    }

    static boolean hasShareTag(String title, String description) {
        return containsShareTag(title) || containsShareTag(description);
    }

    private static boolean containsShareTag(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.contains("[共有]") || text.toLowerCase(Locale.ROOT).contains("#share");
    }

    private static URI validateIcalUri(String url) {
        try {
            URI uri = URI.create(url);
            String scheme = uri.getScheme();
            if (scheme == null || (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "iCal URL は http:// または https:// で指定してください");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "iCal URL の形式が正しくありません");
            }
            return uri;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "iCal URL の形式が正しくありません");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
