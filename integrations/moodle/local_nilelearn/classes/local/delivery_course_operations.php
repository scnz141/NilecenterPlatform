<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class delivery_course_operations {
    public static function clone(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;

        if ($targetexternalid !== null || $context->contextlevel !== CONTEXT_SYSTEM) {
            throw new \invalid_parameter_exception('Course clone requires the mapped system context.');
        }
        require_once($CFG->dirroot . '/course/externallib.php');
        $source = $DB->get_record(
            'course',
            ['id' => $payload['sourceCourseExternalId']],
            '*',
            MUST_EXIST
        );
        provider_record::require_version($source, $expectedproviderversion);
        $sourcecontext = \context_course::instance($source->id);
        require_capability('moodle/backup:backupcourse', $sourcecontext, $actor->id);
        $categorycontext = \context_coursecat::instance($source->category);
        require_capability('moodle/course:create', $categorycontext, $actor->id);
        require_capability('moodle/restore:restorecourse', $categorycontext, $actor->id);

        $created = \core_course_external::duplicate_course(
            $source->id,
            $payload['fullname'],
            $payload['shortname'],
            $source->category,
            (int)($payload['visible'] ?? false),
            [
                ['name' => 'users', 'value' => 0],
                ['name' => 'role_assignments', 'value' => 0],
                ['name' => 'comments', 'value' => 0],
                ['name' => 'userscompletion', 'value' => 0],
                ['name' => 'logs', 'value' => 0],
                ['name' => 'grade_histories', 'value' => 0],
            ]
        );
        $course = $DB->get_record('course', ['id' => $created['id']], '*', MUST_EXIST);
        return provider_record::result('course', $course, [
            'shortname' => $course->shortname,
            'sourceExternalId' => (string)$source->id,
        ]);
    }

    public static function archive(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        return self::set_visibility(
            false,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function restore(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        return self::set_visibility(
            true,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    private static function set_visibility(
        bool $visible,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;

        require_once($CFG->dirroot . '/course/lib.php');
        $courseid = provider_record::external_id($targetexternalid, 'Course');
        if ($courseid === SITEID || $context->contextlevel !== CONTEXT_COURSE
                || (int)$context->instanceid !== $courseid) {
            throw new \invalid_parameter_exception('Course target context does not match.');
        }
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        provider_record::require_version($course, $expectedproviderversion);
        require_capability('moodle/course:update', $context, $actor->id);
        update_course((object)[
            'id' => $courseid,
            'visible' => (int)$visible,
        ]);
        $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
        return provider_record::result('course', $course, ['visible' => (bool)$course->visible]);
    }
}
