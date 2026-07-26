<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class section_operations {
    public static function upsert(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/course/lib.php');

        if ($payload['mode'] === 'create') {
            $courseid = provider_record::external_id($targetexternalid, 'Course');
            self::require_course_context($context, $courseid);
            require_capability('moodle/course:update', $context, $actor->id);
            $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            provider_record::require_version($course, $expectedproviderversion);
            $section = course_create_section($courseid, $payload['position'] ?? 0);
        } else {
            $sectionid = provider_record::external_id($targetexternalid, 'Section');
            $section = $DB->get_record('course_sections', ['id' => $sectionid], '*', MUST_EXIST);
            self::require_course_context($context, (int)$section->course);
            provider_record::require_version($section, $expectedproviderversion);
            require_capability('moodle/course:update', $context, $actor->id);
        }

        course_update_section($section->course, $section, [
            'name' => $payload['name'],
            'summary' => $payload['summary'] ?? '',
            'summaryformat' => FORMAT_HTML,
            'visible' => (int)($payload['visible'] ?? true),
        ]);
        $section = $DB->get_record('course_sections', ['id' => $section->id], '*', MUST_EXIST);
        return provider_record::result('section', $section, [
            'courseExternalId' => (string)$section->course,
            'position' => (int)$section->section,
            'visible' => (bool)$section->visible,
        ]);
    }

    public static function reorder(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $DB;

        $sectionid = provider_record::external_id($targetexternalid, 'Section');
        $section = $DB->get_record('course_sections', ['id' => $sectionid], '*', MUST_EXIST);
        self::require_course_context($context, (int)$section->course);
        provider_record::require_version($section, $expectedproviderversion);
        require_capability('moodle/course:movesections', $context, $actor->id);

        $format = course_get_format($section->course);
        $sections = array_values($format->get_modinfo()->get_section_info_all());
        $position = min($payload['position'], count($sections) - 1);
        $destination = $sections[max(0, $position - 1)] ?? $sections[0];
        $sectioninfo = $format->get_modinfo()->get_section_info_by_id($sectionid);
        if (!$sectioninfo || !$destination) {
            throw new \invalid_parameter_exception('Section position is invalid.');
        }
        $format->move_section_after($sectioninfo, $destination);
        $section = $DB->get_record('course_sections', ['id' => $sectionid], '*', MUST_EXIST);
        return provider_record::result('section', $section, [
            'courseExternalId' => (string)$section->course,
            'position' => (int)$section->section,
        ]);
    }

    public static function visibility(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/course/lib.php');

        $sectionid = provider_record::external_id($targetexternalid, 'Section');
        $section = $DB->get_record('course_sections', ['id' => $sectionid], '*', MUST_EXIST);
        self::require_course_context($context, (int)$section->course);
        provider_record::require_version($section, $expectedproviderversion);
        require_capability('moodle/course:sectionvisibility', $context, $actor->id);
        course_update_section($section->course, $section, [
            'visible' => (int)$payload['visible'],
        ]);
        $section = $DB->get_record('course_sections', ['id' => $sectionid], '*', MUST_EXIST);
        return provider_record::result('section', $section, ['visible' => (bool)$section->visible]);
    }

    private static function require_course_context(\context $context, int $courseid): void {
        if ($context->contextlevel !== CONTEXT_COURSE || (int)$context->instanceid !== $courseid) {
            throw new \invalid_parameter_exception('Section target context does not match.');
        }
    }
}
