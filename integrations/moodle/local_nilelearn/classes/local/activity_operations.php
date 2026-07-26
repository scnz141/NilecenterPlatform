<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class activity_operations {
    public static function upsert_page(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG;
        require_once($CFG->libdir . '/resourcelib.php');
        $fields = [
            'content' => $payload['content'],
            'contentformat' => FORMAT_HTML,
            'page' => [
                'text' => $payload['content'],
                'format' => FORMAT_HTML,
                'itemid' => 0,
            ],
            'display' => RESOURCELIB_DISPLAY_AUTO,
            'printintro' => 0,
            'printlastmodified' => 1,
        ];
        return self::upsert_module(
            'page',
            $payload,
            $fields,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function upsert_book(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG;
        require_once($CFG->dirroot . '/mod/book/locallib.php');
        return self::upsert_module(
            'book',
            $payload,
            ['numbering' => BOOK_NUM_NUMBERS, 'customtitles' => 0],
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function upsert_url(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG;
        require_once($CFG->libdir . '/resourcelib.php');
        return self::upsert_module(
            'url',
            $payload,
            [
                'externalurl' => $payload['externalUrl'],
                'display' => RESOURCELIB_DISPLAY_AUTO,
                'printintro' => 0,
            ],
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function upsert_resource(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion,
        int $transportuserid
    ): array {
        global $CFG;
        require_once($CFG->libdir . '/resourcelib.php');
        $payload['draftItemId'] = self::stage_validated_draft_file(
            $payload,
            $actor,
            $transportuserid
        );
        $result = self::upsert_module(
            'resource',
            $payload,
            [
                'files' => $payload['draftItemId'],
                'display' => RESOURCELIB_DISPLAY_AUTO,
                'printintro' => 0,
                'showsize' => 1,
                'showtype' => 1,
                'uploaded' => 1,
            ],
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
        if ($transportuserid !== (int)$actor->id) {
            get_file_storage()->delete_area_files(
                \context_user::instance($transportuserid)->id,
                'user',
                'draft',
                $payload['draftItemId']
            );
        }
        return $result;
    }

    public static function archive_resource(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        return self::archive_module(
            'resource',
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function archive_module(
        string $modulename,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/course/lib.php');

        $cmid = provider_record::external_id($targetexternalid, 'Activity');
        [$course, $cm] = get_course_and_cm_from_cmid($cmid, $modulename);
        self::require_module_context($context, $cmid);
        $record = $DB->get_record($modulename, ['id' => $cm->instance], '*', MUST_EXIST);
        provider_record::require_version($record, $expectedproviderversion);
        require_capability('moodle/course:activityvisibility', $context, $actor->id);
        set_coursemodule_visible($cmid, 0, 1);
        \core\event\course_module_updated::create_from_cm($cm, $context)->trigger();
        $record = $DB->get_record($modulename, ['id' => $cm->instance], '*', MUST_EXIST);
        return provider_record::result($modulename, $record, [
            'courseModuleExternalId' => (string)$cmid,
            'visible' => false,
        ]);
    }

    public static function upsert_module(
        string $modulename,
        array $payload,
        array $modulefields,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->dirroot . '/course/modlib.php');
        require_once($CFG->dirroot . "/mod/{$modulename}/lib.php");

        if ($payload['mode'] === 'create') {
            $courseid = provider_record::external_id($targetexternalid, 'Course');
            self::require_course_context($context, $courseid);
            require_capability('moodle/course:manageactivities', $context, $actor->id);
            $course = $DB->get_record('course', ['id' => $courseid], '*', MUST_EXIST);
            provider_record::require_version($course, $expectedproviderversion);
            $moduleinfo = self::base_moduleinfo(
                $modulename,
                $course,
                $payload,
                $modulefields
            );
            $created = add_moduleinfo($moduleinfo, $course);
            $cmid = (int)$created->coursemodule;
            $instanceid = (int)$created->instance;
        } else {
            $cmid = provider_record::external_id($targetexternalid, 'Activity');
            [$course, $cm] = get_course_and_cm_from_cmid($cmid, $modulename);
            self::require_module_context($context, $cmid);
            require_capability('moodle/course:manageactivities', $context, $actor->id);
            $existing = $DB->get_record($modulename, ['id' => $cm->instance], '*', MUST_EXIST);
            provider_record::require_version($existing, $expectedproviderversion);
            $instanceid = (int)$existing->id;
            $update = (object)array_merge((array)$existing, $modulefields, [
                'instance' => $instanceid,
                'coursemodule' => $cmid,
                'course' => $course->id,
                'name' => $payload['name'],
                'intro' => $payload['intro'] ?? '',
                'introformat' => FORMAT_HTML,
            ]);
            $updatefunction = $modulename . '_update_instance';
            if (!$updatefunction($update, null)) {
                throw new \moodle_exception('cannotupdatemod', 'error');
            }
            set_coursemodule_name($cmid, $payload['name']);
            if (array_key_exists('visible', $payload)) {
                set_coursemodule_visible($cmid, (int)$payload['visible'], 1);
            }
            rebuild_course_cache($course->id, true);
        }

        $record = $DB->get_record($modulename, ['id' => $instanceid], '*', MUST_EXIST);
        $cm = get_coursemodule_from_instance($modulename, $instanceid, $record->course, false, MUST_EXIST);
        return provider_record::result($modulename, $record, [
            'courseModuleExternalId' => (string)$cm->id,
            'courseExternalId' => (string)$record->course,
            'visible' => (bool)$cm->visible,
        ]);
    }

    private static function base_moduleinfo(
        string $modulename,
        \stdClass $course,
        array $payload,
        array $modulefields
    ): \stdClass {
        global $DB;
        return (object)array_merge([
            'modulename' => $modulename,
            'module' => (int)$DB->get_field('modules', 'id', ['name' => $modulename], MUST_EXIST),
            'course' => $course->id,
            'section' => $payload['sectionNumber'] ?? 0,
            'name' => $payload['name'],
            'intro' => $payload['intro'] ?? '',
            'introformat' => FORMAT_HTML,
            'visible' => (int)($payload['visible'] ?? true),
            'visibleoncoursepage' => 1,
            'cmidnumber' => '',
            'groupmode' => 0,
            'groupingid' => 0,
            'availability' => null,
            'completion' => 0,
            'completionview' => 0,
            'completionexpected' => 0,
            'completionpassgrade' => 0,
            'showdescription' => 0,
        ], $modulefields);
    }

    private static function stage_validated_draft_file(
        array $payload,
        \stdClass $actor,
        int $transportuserid
    ): int {
        $storage = get_file_storage();
        $transportcontext = \context_user::instance($transportuserid);
        $files = $storage->get_area_files(
            $transportcontext->id,
            'user',
            'draft',
            $payload['draftItemId'],
            'id',
            false
        );
        if (count($files) !== 1) {
            throw new \invalid_parameter_exception('Resource draft must contain exactly one file.');
        }
        $file = reset($files);
        $handle = $file->get_content_file_handle();
        $hash = hash_init('sha256');
        hash_update_stream($hash, $handle);
        fclose($handle);
        if ($file->get_filename() !== clean_param($payload['filename'], PARAM_FILE)
                || $file->get_mimetype() !== $payload['mimeType']
                || $file->get_filesize() !== $payload['size']
                || hash_final($hash) !== $payload['sha256']) {
            throw new \invalid_parameter_exception('Resource draft metadata does not match.');
        }

        if ($transportuserid === (int)$actor->id) {
            return (int)$payload['draftItemId'];
        }

        $actorcontext = \context_user::instance($actor->id);
        $actorfiles = $storage->get_area_files(
            $actorcontext->id,
            'user',
            'draft',
            $payload['draftItemId'],
            'id',
            false
        );
        if ($actorfiles) {
            throw new \invalid_parameter_exception('Mapped actor draft item is already in use.');
        }
        $storage->create_file_from_storedfile([
            'contextid' => $actorcontext->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $payload['draftItemId'],
            'filepath' => '/',
            'filename' => $file->get_filename(),
            'userid' => $actor->id,
        ], $file);
        return (int)$payload['draftItemId'];
    }

    private static function require_course_context(\context $context, int $courseid): void {
        if ($context->contextlevel !== CONTEXT_COURSE || (int)$context->instanceid !== $courseid) {
            throw new \invalid_parameter_exception('Activity course context does not match.');
        }
    }

    private static function require_module_context(\context $context, int $cmid): void {
        if ($context->contextlevel !== CONTEXT_MODULE || (int)$context->instanceid !== $cmid) {
            throw new \invalid_parameter_exception('Activity module context does not match.');
        }
    }
}
