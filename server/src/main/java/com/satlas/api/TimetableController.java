package com.satlas.api;

import java.io.IOException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.TimetableImportResponse;
import com.satlas.api.dto.TimetableRequest;
import com.satlas.api.dto.TimetableResponse;
import com.satlas.entity.Semester;
import com.satlas.entity.User;
import com.satlas.security.CurrentUserService;
import com.satlas.service.GeminiTimetableService;
import com.satlas.service.TimetableService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/timetables")
@RequiredArgsConstructor
public class TimetableController {

    private final CurrentUserService currentUserService;
    private final TimetableService timetableService;
    private final GeminiTimetableService geminiTimetableService;

    @GetMapping
    public List<TimetableResponse> list(
            @RequestParam(required = false) Integer academicYear,
            @RequestParam(required = false) Semester semester) {
        Long userId = currentUserService.requireUser().getId();
        return timetableService.list(userId, academicYear, semester).stream()
                .map(TimetableResponse::from)
                .toList();
    }

    /** 1 件以上のコマをまとめて登録（同一スロットは上書き）。 */
    @PostMapping
    public List<TimetableResponse> upsert(@RequestBody List<TimetableRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "登録するコマがありません");
        }
        Long userId = currentUserService.requireUser().getId();
        return timetableService.upsertAll(userId, requests).stream()
                .map(TimetableResponse::from)
                .toList();
    }

    /** PDF を Gemini で解析し、保存前の下書きを返す（DB には保存しない）。 */
    @PostMapping(path = "/import-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TimetableImportResponse importPdf(@RequestPart("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PDF ファイルを選択してください");
        }
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        boolean isPdf = MediaType.APPLICATION_PDF_VALUE.equals(file.getContentType())
                || name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "PDF のみ対応しています");
        }

        User user = currentUserService.requireUser();
        GeminiTimetableService.ParseOutcome outcome = geminiTimetableService.parseTimetablePdf(file.getBytes(), user);
        return new TimetableImportResponse(name, outcome.provider(), outcome.model(), outcome.entries());
    }
}
