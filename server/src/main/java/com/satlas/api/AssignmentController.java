package com.satlas.api;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.AssignmentRequest;
import com.satlas.api.dto.AssignmentResponse;
import com.satlas.entity.Assignment;
import com.satlas.repository.AssignmentRepository;
import com.satlas.security.CurrentUserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final CurrentUserService currentUserService;
    private final AssignmentRepository assignmentRepository;

    /** 未完了 → 期限が近い順。 */
    @GetMapping
    public List<AssignmentResponse> list() {
        Long userId = currentUserService.requireUser().getId();
        return assignmentRepository.findByUserIdOrderByCompletedAscDueDateAsc(userId).stream()
                .map(AssignmentResponse::from)
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AssignmentResponse create(@RequestBody AssignmentRequest req) {
        if (req.title() == null || req.title().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title は必須です");
        }
        Assignment a = new Assignment();
        a.setUserId(currentUserService.requireUser().getId());
        a.setTitle(req.title().trim());
        a.setSubject(req.subject());
        a.setDueDate(req.dueDate());
        a.setCompleted(Boolean.TRUE.equals(req.completed()));
        return AssignmentResponse.from(assignmentRepository.save(a));
    }

    @PatchMapping("/{id}")
    @Transactional
    public AssignmentResponse update(@PathVariable Long id, @RequestBody AssignmentRequest req) {
        Long userId = currentUserService.requireUser().getId();
        Assignment a = assignmentRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "課題が見つかりません"));
        if (req.title() != null) {
            if (req.title().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "title を空にはできません");
            }
            a.setTitle(req.title().trim());
        }
        if (req.subject() != null) {
            a.setSubject(req.subject().isBlank() ? null : req.subject());
        }
        if (req.dueDate() != null) {
            a.setDueDate(req.dueDate());
        }
        if (req.completed() != null) {
            a.setCompleted(req.completed());
        }
        return AssignmentResponse.from(assignmentRepository.save(a));
    }
}
