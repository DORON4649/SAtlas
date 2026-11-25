package com.satlas.api;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.CalendarEventRequest;
import com.satlas.api.dto.CalendarEventResponse;
import com.satlas.api.dto.GoogleSyncResponse;
import com.satlas.entity.User;
import com.satlas.security.CurrentUserService;
import com.satlas.service.CalendarService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");

    private final CurrentUserService currentUserService;
    private final CalendarService calendarService;

    /**
     * 自分の予定＋他ユーザーの共有予定＋未完了課題締切を期間指定で取得。
     * start / end は ISO LocalDateTime, OffsetDateTime, LocalDate のいずれにも対応。
     */
    @GetMapping("/events")
    public List<CalendarEventResponse> listEvents(
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        User user = currentUserService.requireUser();
        LocalDate now = LocalDate.now(TOKYO);
        LocalDateTime rangeStart = start != null ? parseBoundary(start, false) : now.withDayOfMonth(1).atStartOfDay();
        LocalDateTime rangeEnd = end != null
                ? parseBoundary(end, true)
                : now.withDayOfMonth(now.lengthOfMonth()).atTime(23, 59, 59);
        return calendarService.listUnified(user, rangeStart, rangeEnd);
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarEventResponse create(@RequestBody CalendarEventRequest req) {
        return calendarService.create(currentUserService.requireUser(), req);
    }

    @PatchMapping("/events/{id}")
    public CalendarEventResponse update(@PathVariable Long id, @RequestBody CalendarEventRequest req) {
        return calendarService.update(currentUserService.requireUser(), id, req);
    }

    @DeleteMapping("/events/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        calendarService.delete(currentUserService.requireUser(), id);
    }

    @PostMapping("/sync-google")
    public GoogleSyncResponse syncGoogle() {
        return calendarService.syncGoogleIcal(currentUserService.requireUser());
    }

    private static LocalDateTime parseBoundary(String raw, boolean endOfDay) {
        String s = raw.trim();
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(s).atZoneSameInstant(TOKYO).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
        }
        try {
            LocalDate d = LocalDate.parse(s);
            return endOfDay ? d.atTime(23, 59, 59) : d.atStartOfDay();
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "日時フォーマットが不正です: " + raw);
        }
    }
}
