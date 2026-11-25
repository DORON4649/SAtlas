package com.satlas.service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Component;

/**
 * RFC 5545 (iCalendar / .ics) の VEVENT をパースする軽量パーサー。
 */
@Component
public class IcalParser {

    private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");
    private static final DateTimeFormatter BASIC_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter BASIC_DATETIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");

    public record ParsedEvent(
            String uid,
            String summary,
            String description,
            LocalDateTime startAt,
            LocalDateTime endAt,
            boolean allDay) {
    }

    public List<ParsedEvent> parse(String icsContent) {
        if (icsContent == null || icsContent.isBlank()) {
            return List.of();
        }
        // RFC 5545 折り返し行 (CRLF/LF + SPACE/TAB) を結合
        String unfolded = icsContent
                .replace("\r\n ", "")
                .replace("\r\n\t", "")
                .replace("\n ", "")
                .replace("\n\t", "");

        String[] lines = unfolded.split("\\r?\\n");
        List<ParsedEvent> results = new ArrayList<>();

        boolean inEvent = false;
        String uid = null;
        String summary = null;
        String description = null;
        String status = null;
        ParsedDateTime dtStart = null;
        ParsedDateTime dtEnd = null;
        String durationRaw = null;

        for (String line : lines) {
            String trimmed = line.trim();
            if ("BEGIN:VEVENT".equalsIgnoreCase(trimmed)) {
                inEvent = true;
                uid = null;
                summary = null;
                description = null;
                status = null;
                dtStart = null;
                dtEnd = null;
                durationRaw = null;
                continue;
            }
            if ("END:VEVENT".equalsIgnoreCase(trimmed)) {
                if (inEvent && !"CANCELLED".equalsIgnoreCase(status) && dtStart != null) {
                    String safeTitle = (summary == null || summary.isBlank()) ? "(無題の予定)" : summary;
                    LocalDateTime endAt = resolveEnd(dtStart, dtEnd, durationRaw);
                    String safeUid = (uid == null || uid.isBlank())
                            ? safeTitle + "|" + dtStart.dateTime()
                            : uid;
                    results.add(new ParsedEvent(safeUid, safeTitle, description, dtStart.dateTime(), endAt, dtStart.allDay()));
                }
                inEvent = false;
                continue;
            }
            if (!inEvent) {
                continue;
            }

            int colonIdx = line.indexOf(':');
            if (colonIdx <= 0) {
                continue;
            }
            String header = line.substring(0, colonIdx);
            String value = line.substring(colonIdx + 1);

            int semiIdx = header.indexOf(';');
            String propName = (semiIdx >= 0 ? header.substring(0, semiIdx) : header).toUpperCase(Locale.ROOT);
            String params = semiIdx >= 0 ? header.substring(semiIdx + 1) : "";

            switch (propName) {
                case "UID" -> uid = value.trim();
                case "SUMMARY" -> summary = unescape(value);
                case "DESCRIPTION" -> description = unescape(value);
                case "STATUS" -> status = value.trim();
                case "DTSTART" -> dtStart = parseDateTime(value.trim(), params);
                case "DTEND" -> dtEnd = parseDateTime(value.trim(), params);
                case "DURATION" -> durationRaw = value.trim();
                default -> {
                    // その他のプロパティは無視
                }
            }
        }
        return results;
    }

    private static LocalDateTime resolveEnd(ParsedDateTime start, ParsedDateTime end, String durationRaw) {
        if (end != null) {
            // 終日イベントの DTEND は排他日 (翌日 00:00) が標準。同一または逆転していれば補正
            if (end.dateTime().isBefore(start.dateTime())) {
                return start.allDay() ? start.dateTime().plusDays(1) : start.dateTime().plusHours(1);
            }
            return end.dateTime();
        }
        if (durationRaw != null && !durationRaw.isBlank()) {
            try {
                return start.dateTime().plus(Duration.parse(durationRaw));
            } catch (DateTimeParseException ignored) {
                // fallback below
            }
        }
        return start.allDay() ? start.dateTime().plusDays(1) : start.dateTime().plusHours(1);
    }

    private record ParsedDateTime(LocalDateTime dateTime, boolean allDay) {
    }

    private static ParsedDateTime parseDateTime(String raw, String params) {
        if (raw.isEmpty()) {
            return null;
        }
        boolean valueDate = params.toUpperCase(Locale.ROOT).contains("VALUE=DATE")
                && !params.toUpperCase(Locale.ROOT).contains("VALUE=DATE-TIME");

        // 終日 (YYYYMMDD)
        if (valueDate || raw.length() == 8) {
            try {
                LocalDate date = LocalDate.parse(raw.substring(0, 8), BASIC_DATE);
                return new ParsedDateTime(date.atStartOfDay(), true);
            } catch (DateTimeParseException e) {
                return null;
            }
        }

        // UTC (YYYYMMDDTHHMMSSZ)
        if (raw.endsWith("Z") && raw.length() >= 16) {
            try {
                LocalDateTime utc = LocalDateTime.parse(raw.substring(0, 15), BASIC_DATETIME);
                LocalDateTime jst = utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(TOKYO).toLocalDateTime();
                return new ParsedDateTime(jst, false);
            } catch (DateTimeParseException e) {
                return null;
            }
        }

        // タイムゾーン指定あり / フローティング (YYYYMMDDTHHMMSS)
        if (raw.length() >= 15) {
            try {
                LocalDateTime local = LocalDateTime.parse(raw.substring(0, 15), BASIC_DATETIME);
                ZoneId zone = extractZone(params);
                if (zone != null) {
                    LocalDateTime jst = local.atZone(zone).withZoneSameInstant(TOKYO).toLocalDateTime();
                    return new ParsedDateTime(jst, false);
                }
                return new ParsedDateTime(local, false);
            } catch (DateTimeParseException e) {
                return null;
            }
        }
        return null;
    }

    private static ZoneId extractZone(String params) {
        if (params == null || params.isBlank()) {
            return null;
        }
        for (String part : params.split(";")) {
            if (part.toUpperCase(Locale.ROOT).startsWith("TZID=")) {
                String tz = part.substring(5).replace("\"", "").trim();
                try {
                    return ZoneId.of(tz);
                } catch (Exception ignored) {
                    return null;
                }
            }
        }
        return null;
    }

    private static String unescape(String s) {
        if (s == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char next = s.charAt(++i);
                switch (next) {
                    case 'n', 'N' -> sb.append('\n');
                    case ',' -> sb.append(',');
                    case ';' -> sb.append(';');
                    case '\\' -> sb.append('\\');
                    default -> sb.append(next);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
