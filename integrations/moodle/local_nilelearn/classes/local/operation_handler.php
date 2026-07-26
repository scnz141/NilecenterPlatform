<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

/**
 * Closed operation dispatcher.
 *
 * Provider families are registered only after their Moodle PHPUnit and live
 * synthetic lifecycle pass. An allowlisted but unregistered operation fails
 * closed and is never reported as applied.
 */
final class operation_handler {
    private const HANDLERS = [
        'delivery_course.clone' => [delivery_course_operations::class, 'clone'],
        'delivery_course.archive' => [delivery_course_operations::class, 'archive'],
        'delivery_course.restore' => [delivery_course_operations::class, 'restore'],
        'section.upsert' => [section_operations::class, 'upsert'],
        'section.reorder' => [section_operations::class, 'reorder'],
        'section.visibility' => [section_operations::class, 'visibility'],
        'page.upsert' => [activity_operations::class, 'upsert_page'],
        'book.upsert' => [activity_operations::class, 'upsert_book'],
        'url.upsert' => [activity_operations::class, 'upsert_url'],
        'resource.upsert' => [activity_operations::class, 'upsert_resource'],
        'resource.archive' => [activity_operations::class, 'archive_resource'],
        'assignment.upsert' => [assessment_operations::class, 'upsert_assignment'],
        'assignment.archive' => [assessment_operations::class, 'archive_assignment'],
        'quiz_shell.upsert' => [assessment_operations::class, 'upsert_quiz'],
        'quiz.archive' => [assessment_operations::class, 'archive_quiz'],
        'question.upsert' => [assessment_operations::class, 'upsert_question'],
        'question.move' => [assessment_operations::class, 'move_question'],
        'grade.update' => [outcome_operations::class, 'update_grade'],
        'completion.update' => [outcome_operations::class, 'update_completion'],
    ];

    public static function execute(
        string $operation,
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion,
        int $transportuserid
    ): array {
        if (!array_key_exists($operation, self::HANDLERS)) {
            throw new \moodle_exception(
                'operationnotimplemented',
                'local_nilelearn',
                '',
                $operation
            );
        }
        $validated = operation_payload::validate($operation, $payload);
        $callable = self::HANDLERS[$operation];
        $arguments = [
            $validated,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion,
        ];
        if ($operation === 'resource.upsert') {
            $arguments[] = $transportuserid;
        }
        return $callable(...$arguments);
    }
}
