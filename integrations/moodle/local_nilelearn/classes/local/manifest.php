<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class manifest {
    public const PROTOCOL_VERSION = '1.0';
    public const PLUGIN_VERSION = '0.2.0';

    private const OPERATIONS = [
        'delivery_course.clone' => 'moodle/course:create',
        'delivery_course.archive' => 'moodle/course:update',
        'delivery_course.restore' => 'moodle/course:update',
        'section.upsert' => 'moodle/course:manageactivities',
        'section.reorder' => 'moodle/course:sectionvisibility',
        'section.visibility' => 'moodle/course:sectionvisibility',
        'page.upsert' => 'moodle/course:manageactivities',
        'book.upsert' => 'moodle/course:manageactivities',
        'url.upsert' => 'moodle/course:manageactivities',
        'resource.upsert' => 'moodle/course:manageactivities',
        'resource.archive' => 'moodle/course:manageactivities',
        'assignment.upsert' => 'moodle/course:manageactivities',
        'assignment.archive' => 'moodle/course:manageactivities',
        'quiz_shell.upsert' => 'moodle/course:manageactivities',
        'quiz.archive' => 'moodle/course:manageactivities',
        'question.upsert' => 'moodle/question:editall',
        'question.move' => 'moodle/question:moveall',
        'grade.update' => 'moodle/grade:edit',
        'completion.update' => 'moodle/course:overridecompletion',
    ];

    private const NATIVE_LAUNCH_KINDS = [
        'lesson_authoring',
        'h5p_authoring',
        'scorm_authoring',
        'video_time_authoring',
        'quiz_attempt',
        'assignment_submission',
    ];

    public static function operations(): array {
        return self::OPERATIONS;
    }

    public static function native_launch_kinds(): array {
        return self::NATIVE_LAUNCH_KINDS;
    }

    public static function operation_capability(string $operation): string {
        if (!array_key_exists($operation, self::OPERATIONS)) {
            throw new \invalid_parameter_exception('Operation is not allowlisted.');
        }
        return self::OPERATIONS[$operation];
    }

    public static function export(): array {
        $operations = [];
        foreach (self::OPERATIONS as $name => $requiredcapability) {
            $operations[] = [
                'name' => $name,
                'requiredCapability' => $requiredcapability,
            ];
        }
        return [
            'component' => 'local_nilelearn',
            'pluginVersion' => self::PLUGIN_VERSION,
            'protocolVersion' => self::PROTOCOL_VERSION,
            'operations' => $operations,
            'nativeLaunchKinds' => self::NATIVE_LAUNCH_KINDS,
        ];
    }
}
