package com.assassin.api.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** A business error, rendered as an RFC 9457 ProblemDetail with a machine-readable {@code code}. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, Object> properties;

    public ApiException(HttpStatus status, String code, String detail) {
        this(status, code, detail, Map.of());
    }

    /** {@code properties} are added to the ProblemDetail next to {@code code}. */
    public ApiException(HttpStatus status, String code, String detail, Map<String, Object> properties) {
        super(detail);
        this.status = status;
        this.code = code;
        this.properties = properties;
    }

    public Map<String, Object> getProperties() {
        return properties;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
