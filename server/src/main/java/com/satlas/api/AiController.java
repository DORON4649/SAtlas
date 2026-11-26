package com.satlas.api;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.ai.AiResult;
import com.satlas.ai.AiService;
import com.satlas.api.dto.AiChatRequest;
import com.satlas.api.dto.AiChatResponse;
import com.satlas.api.dto.AiContextType;
import com.satlas.entity.Assignment;
import com.satlas.entity.LectureNote;
import com.satlas.entity.Semester;
import com.satlas.entity.Timetable;
import com.satlas.entity.User;
import com.satlas.repository.AssignmentRepository;
import com.satlas.repository.TimetableRepository;
import com.satlas.security.CurrentUserService;
import com.satlas.service.LectureNoteService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private static final ZoneId TOKYO = ZoneId.of("Asia/Tokyo");
    private static final String[] DAY_NAMES = { "", "月", "火", "水", "木", "金", "土", "日" };
    private static final DateTimeFormatter DUE_FMT = DateTimeFormatter.ofPattern("yyyy/MM/dd HH:mm");

    private static final int MAX_NOTE_CONTEXT_CHARS = 12_000;

    private final CurrentUserService currentUserService;
    private final AiService aiService;
    private final TimetableRepository timetableRepository;
    private final AssignmentRepository assignmentRepository;
    private final LectureNoteService lectureNoteService;

    @PostMapping("/chat")
    public AiChatResponse chat(@RequestBody AiChatRequest req) {
        if (req == null || req.message() == null || req.message().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "message は必須です");
        }
        User user = currentUserService.requireUser();
        AiContextType contextType = req.contextType() != null ? req.contextType() : AiContextType.NONE;
        String systemPrompt = buildSystemPrompt(user, contextType, req);

        AiResult result = aiService.chat(user, systemPrompt, req.message().trim());
        return new AiChatResponse(result.text(), result.provider(), result.model(), contextType);
    }

    private String buildSystemPrompt(User user, AiContextType contextType, AiChatRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("あなたは大学生活支援プラットフォーム「SAtlas」の学生向け AI アシスタントです。簡潔で分かりやすい日本語で回答してください。\n");
        sb.append("ユーザー名: ").append(user.getName()).append("\n");

        LocalDate today = LocalDate.now(TOKYO);
        sb.append("今日の日付: ").append(today).append("（").append(DAY_NAMES[today.getDayOfWeek().getValue()]).append("曜日）\n");

        if (contextType == AiContextType.TODAY_SCHEDULE) {
            int month = today.getMonthValue();
            int academicYear = month < 4 ? today.getYear() - 1 : today.getYear();
            Semester currentSemester = (month >= 4 && month <= 9) ? Semester.SPRING : Semester.FALL;
            int dow = today.getDayOfWeek().getValue();

            List<Timetable> todayClasses = timetableRepository
                    .findByUserIdAndAcademicYearOrderByDayOfWeekAscPeriodAsc(user.getId(), academicYear).stream()
                    .filter(t -> t.getDayOfWeek() == dow
                            && (t.getSemester() == currentSemester || t.getSemester() == Semester.FULL_YEAR))
                    .toList();

            sb.append("\n【添付コンテキスト：今日の時間割】\n");
            if (todayClasses.isEmpty()) {
                sb.append("今日の登録済み授業はありません。\n");
            } else {
                for (Timetable t : todayClasses) {
                    sb.append("- ").append(t.getPeriod()).append("限: ").append(t.getSubject());
                    if (t.getCampus() != null && !t.getCampus().isBlank()) {
                        sb.append(" / ").append(t.getCampus());
                    }
                    if (t.getRoom() != null && !t.getRoom().isBlank()) {
                        sb.append(" ").append(t.getRoom());
                    }
                    sb.append("\n");
                }
            }
        } else if (contextType == AiContextType.ASSIGNMENTS) {
            List<Assignment> pending = assignmentRepository.findByUserIdOrderByCompletedAscDueDateAsc(user.getId())
                    .stream()
                    .filter(a -> !a.isCompleted())
                    .toList();

            sb.append("\n【添付コンテキスト：未完了課題一覧】\n");
            if (pending.isEmpty()) {
                sb.append("現在、未完了の課題はありません。\n");
            } else {
                for (Assignment a : pending) {
                    sb.append("- ").append(a.getTitle());
                    if (a.getSubject() != null && !a.getSubject().isBlank()) {
                        sb.append("（科目: ").append(a.getSubject()).append("）");
                    }
                    if (a.getDueDate() != null) {
                        sb.append(" 締切: ").append(a.getDueDate().format(DUE_FMT));
                    }
                    sb.append("\n");
                }
            }
        } else if (contextType == AiContextType.NOTEBOOK) {
            appendNotebookContext(sb, user, req);
        }
        return sb.toString();
    }

    private void appendNotebookContext(StringBuilder sb, User user, AiChatRequest req) {
        LectureNote ownedNote = lectureNoteService.findOwned(user.getId(), req.noteId()).orElse(null);
        String subjectName = ownedNote != null ? ownedNote.getSubjectName() : null;
        String title = (req.noteTitle() != null && !req.noteTitle().isBlank())
                ? req.noteTitle().trim()
                : (ownedNote != null ? ownedNote.getTitle() : null);
        String content = (req.noteContent() != null && !req.noteContent().isBlank())
                ? req.noteContent()
                : (ownedNote != null ? ownedNote.getContentMarkdown() : null);

        sb.append("\n【添付コンテキスト：開いている講義ノート】\n");
        if ((title == null || title.isBlank()) && (content == null || content.isBlank())) {
            sb.append("ノートの内容が添付されていません。\n");
            return;
        }
        if (subjectName != null && !subjectName.isBlank()) {
            sb.append("科目: ").append(subjectName).append("\n");
        }
        if (title != null && !title.isBlank()) {
            sb.append("タイトル: ").append(title).append("\n");
        }
        if (content != null && !content.isBlank()) {
            String trimmed = content.length() > MAX_NOTE_CONTEXT_CHARS
                    ? content.substring(0, MAX_NOTE_CONTEXT_CHARS) + "\n...(省略)"
                    : content;
            sb.append("本文:\n").append(trimmed).append("\n");
        }
        sb.append("上記の講義ノート（数式やコードセルを含む）を踏まえて、要約・解説・確認問題作成などの質問に丁寧に回答してください。\n");
    }
}
