package com.satlas.ai;

/** Gemini API で HTTP 429 または RESOURCE_EXHAUSTED（トークン/クォータ上限）が発生した際の例外。 */
public class AiQuotaExceededException extends RuntimeException {

    public AiQuotaExceededException(String message, Throwable cause) {
        super(message, cause);
    }
}
