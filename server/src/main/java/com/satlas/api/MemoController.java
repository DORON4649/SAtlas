package com.satlas.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.MemoRequest;
import com.satlas.api.dto.MemoResponse;
import com.satlas.entity.Memo;
import com.satlas.repository.MemoRepository;
import com.satlas.security.CurrentUserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/memos")
@RequiredArgsConstructor
public class MemoController {

    private static final int MAX_CONTENT_LENGTH = 10_000;

    private final CurrentUserService currentUserService;
    private final MemoRepository memoRepository;

    /** 自分のメモ（includeShared=true で他ユーザーの共有メモも含める）。 */
    @GetMapping
    public List<MemoResponse> list(@RequestParam(defaultValue = "false") boolean includeShared) {
        Long userId = currentUserService.requireUser().getId();
        List<Memo> memos = includeShared ? memoRepository.findOwnAndShared(userId) : memoRepository.findOwn(userId);
        return memos.stream().map(m -> MemoResponse.from(m, userId)).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public MemoResponse create(@RequestBody MemoRequest req) {
        if (req.content() == null || req.content().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content は必須です");
        }
        if (req.content().length() > MAX_CONTENT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "メモが長すぎます");
        }
        Long userId = currentUserService.requireUser().getId();
        Memo memo = new Memo();
        memo.setUserId(userId);
        memo.setContent(req.content());
        memo.setShared(Boolean.TRUE.equals(req.isShared()));
        return MemoResponse.from(memoRepository.save(memo), userId);
    }
}
