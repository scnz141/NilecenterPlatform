<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

/**
 * Closed validation for provider command payloads.
 *
 * External Moodle identifiers are supplied separately by the Nile server. They
 * are never accepted from a browser-authored payload.
 */
final class operation_payload {
    private const SCHEMAS = [
        'delivery_course.clone' => [
            'required' => ['sourceCourseExternalId', 'fullname', 'shortname'],
            'optional' => ['visible'],
        ],
        'delivery_course.archive' => ['required' => [], 'optional' => ['reason']],
        'delivery_course.restore' => ['required' => [], 'optional' => []],
        'section.upsert' => [
            'required' => ['mode', 'name'],
            'optional' => ['summary', 'visible', 'position'],
        ],
        'section.reorder' => ['required' => ['position'], 'optional' => []],
        'section.visibility' => ['required' => ['visible'], 'optional' => []],
        'page.upsert' => [
            'required' => ['mode', 'name', 'content'],
            'optional' => ['sectionNumber', 'intro', 'visible'],
        ],
        'book.upsert' => [
            'required' => ['mode', 'name'],
            'optional' => ['sectionNumber', 'intro', 'visible'],
        ],
        'url.upsert' => [
            'required' => ['mode', 'name', 'externalUrl'],
            'optional' => ['sectionNumber', 'intro', 'visible'],
        ],
        'resource.upsert' => [
            'required' => ['mode', 'name', 'draftItemId', 'filename', 'mimeType', 'size', 'sha256'],
            'optional' => ['sectionNumber', 'intro', 'visible'],
        ],
        'resource.archive' => ['required' => [], 'optional' => ['reason']],
        'assignment.upsert' => [
            'required' => ['mode', 'name'],
            'optional' => [
                'sectionNumber', 'intro', 'visible', 'availableFrom', 'dueAt',
                'cutoffAt', 'maximumGrade',
            ],
        ],
        'assignment.archive' => ['required' => [], 'optional' => ['reason']],
        'quiz_shell.upsert' => [
            'required' => ['mode', 'name'],
            'optional' => [
                'sectionNumber', 'intro', 'visible', 'opensAt', 'closesAt',
                'timeLimitSeconds', 'maximumGrade',
            ],
        ],
        'quiz.archive' => ['required' => [], 'optional' => ['reason']],
        'question.upsert' => [
            'required' => ['mode', 'questionType', 'name', 'questionText', 'defaultMark'],
            'optional' => ['categoryExternalId', 'answers', 'correctAnswer', 'generalFeedback'],
        ],
        'question.move' => ['required' => ['destinationCategoryExternalId'], 'optional' => []],
        'grade.update' => [
            'required' => ['userExternalId', 'grade'],
            'optional' => ['feedback'],
        ],
        'completion.update' => [
            'required' => ['userExternalId', 'state'],
            'optional' => [],
        ],
    ];

    public static function validate(string $operation, array $payload): array {
        if (!isset(self::SCHEMAS[$operation]) || array_is_list($payload)) {
            throw new \invalid_parameter_exception('Unsupported Moodle operation payload.');
        }
        $schema = self::SCHEMAS[$operation];
        $keys = array_keys($payload);
        $allowed = array_merge($schema['required'], $schema['optional']);
        foreach ($schema['required'] as $required) {
            if (!array_key_exists($required, $payload)) {
                throw new \invalid_parameter_exception("Missing payload field: {$required}");
            }
        }
        foreach ($keys as $key) {
            if (!in_array($key, $allowed, true)) {
                throw new \invalid_parameter_exception("Unexpected payload field: {$key}");
            }
        }

        self::validate_common($operation, $payload);
        return $payload;
    }

    private static function validate_common(string $operation, array $payload): void {
        foreach (['name', 'fullname', 'shortname', 'filename'] as $field) {
            if (array_key_exists($field, $payload)) {
                self::require_text($payload[$field], $field, $field === 'shortname' ? 100 : 255);
            }
        }
        foreach (['intro', 'summary', 'content', 'questionText', 'generalFeedback', 'feedback', 'reason'] as $field) {
            if (array_key_exists($field, $payload)) {
                self::require_text($payload[$field], $field, 20000, true);
            }
        }
        foreach (['visible'] as $field) {
            if (array_key_exists($field, $payload) && !is_bool($payload[$field])) {
                throw new \invalid_parameter_exception("{$field} must be boolean.");
            }
        }
        foreach ([
            'sourceCourseExternalId', 'draftItemId', 'size', 'sectionNumber',
            'position', 'availableFrom', 'dueAt', 'cutoffAt', 'maximumGrade',
            'opensAt', 'closesAt', 'timeLimitSeconds', 'categoryExternalId',
            'destinationCategoryExternalId', 'userExternalId',
        ] as $field) {
            if (array_key_exists($field, $payload)
                    && (!is_int($payload[$field]) || $payload[$field] < 0)) {
                throw new \invalid_parameter_exception("{$field} must be a non-negative integer.");
            }
        }
        if (isset($payload['mode']) && !in_array($payload['mode'], ['create', 'update'], true)) {
            throw new \invalid_parameter_exception('mode must be create or update.');
        }
        if (isset($payload['externalUrl'])
                && (!is_string($payload['externalUrl'])
                    || !preg_match('/^https:\/\/[^\s]{1,2000}$/i', $payload['externalUrl']))) {
            throw new \invalid_parameter_exception('externalUrl must be HTTPS.');
        }
        if (isset($payload['mimeType'])
                && (!is_string($payload['mimeType'])
                    || !preg_match('/^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/i', $payload['mimeType']))) {
            throw new \invalid_parameter_exception('mimeType is invalid.');
        }
        if (isset($payload['sha256'])
                && (!is_string($payload['sha256']) || !preg_match('/^[a-f0-9]{64}$/', $payload['sha256']))) {
            throw new \invalid_parameter_exception('sha256 is invalid.');
        }
        if ($operation === 'resource.upsert' && $payload['size'] > 104857600) {
            throw new \invalid_parameter_exception('Resource exceeds the 100 MiB limit.');
        }
        if (isset($payload['grade']) && (!is_int($payload['grade']) && !is_float($payload['grade']))) {
            throw new \invalid_parameter_exception('grade must be numeric.');
        }
        if (isset($payload['defaultMark'])
                && (!is_int($payload['defaultMark']) && !is_float($payload['defaultMark']))) {
            throw new \invalid_parameter_exception('defaultMark must be numeric.');
        }
        if (isset($payload['state']) && !in_array($payload['state'], [0, 1, 2, 3], true)) {
            throw new \invalid_parameter_exception('completion state is invalid.');
        }
        if (isset($payload['questionType'])
                && !in_array($payload['questionType'], ['shortanswer', 'truefalse', 'multichoice'], true)) {
            throw new \invalid_parameter_exception('questionType requires a native launch.');
        }
        if (isset($payload['answers']) && (!is_array($payload['answers']) || count($payload['answers']) > 20)) {
            throw new \invalid_parameter_exception('answers is invalid.');
        }
    }

    private static function require_text(
        mixed $value,
        string $field,
        int $maximum,
        bool $allowempty = false
    ): void {
        if (!is_string($value)
                || (!$allowempty && trim($value) === '')
                || \core_text::strlen($value) > $maximum) {
            throw new \invalid_parameter_exception("{$field} is invalid.");
        }
    }
}
