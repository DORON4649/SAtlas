package com.satlas.api.dto;

import tools.jackson.databind.JsonNode;

/** ダッシュボードレイアウト。layout は react-grid-layout の ResponsiveLayouts JSON（任意構造）。 */
public record LayoutPayload(JsonNode layout) {
}
