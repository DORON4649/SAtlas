package com.satlas.api;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.satlas.api.dto.LayoutPayload;
import com.satlas.entity.User;
import com.satlas.repository.UserRepository;
import com.satlas.security.CurrentUserService;

import lombok.RequiredArgsConstructor;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/dashboard/layout")
@RequiredArgsConstructor
public class DashboardController {

    private static final int MAX_LAYOUT_LENGTH = 64 * 1024;

    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final JsonMapper jsonMapper;

    /** 保存済みレイアウト。未保存なら {"layout": null}。 */
    @GetMapping
    public LayoutPayload getLayout() {
        User user = currentUserService.requireUser();
        String stored = user.getDashboardLayout();
        if (stored == null || stored.isBlank()) {
            return new LayoutPayload(null);
        }
        try {
            return new LayoutPayload(jsonMapper.readTree(stored));
        } catch (JacksonException e) {
            return new LayoutPayload(null); // 壊れたデータはデフォルト扱い
        }
    }

    @PutMapping
    @Transactional
    public LayoutPayload saveLayout(@RequestBody LayoutPayload payload) {
        if (payload == null || payload.layout() == null || payload.layout().isNull()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "layout は必須です");
        }
        if (!payload.layout().isObject() && !payload.layout().isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "layout は JSON オブジェクトまたは配列です");
        }
        String json = jsonMapper.writeValueAsString(payload.layout());
        if (json.length() > MAX_LAYOUT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "layout が大きすぎます");
        }
        User user = currentUserService.requireUser();
        user.setDashboardLayout(json);
        userRepository.save(user);
        return payload;
    }
}
