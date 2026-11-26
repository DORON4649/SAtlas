package com.satlas.api;

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

import com.satlas.api.dto.LectureNoteRequest;
import com.satlas.api.dto.LectureNoteResponse;
import com.satlas.security.CurrentUserService;
import com.satlas.service.LectureNoteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class LectureNoteController {

    private final CurrentUserService currentUserService;
    private final LectureNoteService lectureNoteService;

    /** 本人の講義ノート一覧を取得（科目名・キーワード絞り込み対応）。 */
    @GetMapping
    public List<LectureNoteResponse> list(
            @RequestParam(required = false) String subjectName,
            @RequestParam(required = false) String keyword) {
        Long userId = currentUserService.requireUser().getId();
        return lectureNoteService.list(userId, subjectName, keyword);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LectureNoteResponse create(@RequestBody LectureNoteRequest req) {
        Long userId = currentUserService.requireUser().getId();
        return lectureNoteService.create(userId, req);
    }

    @PatchMapping("/{id}")
    public LectureNoteResponse update(@PathVariable Long id, @RequestBody LectureNoteRequest req) {
        Long userId = currentUserService.requireUser().getId();
        return lectureNoteService.update(userId, id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long userId = currentUserService.requireUser().getId();
        lectureNoteService.delete(userId, id);
    }
}
