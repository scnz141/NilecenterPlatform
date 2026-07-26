<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class outcome_operations {
    public static function update_grade(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->libdir . '/gradelib.php');

        $gradeitemid = provider_record::external_id($targetexternalid, 'Grade item');
        $gradeitem = \grade_item::fetch(['id' => $gradeitemid]);
        if (!$gradeitem) {
            throw new \invalid_parameter_exception('Grade item does not exist.');
        }
        $record = $DB->get_record('grade_items', ['id' => $gradeitemid], '*', MUST_EXIST);
        provider_record::require_version($record, $expectedproviderversion);
        $coursecontext = \context_course::instance($gradeitem->courseid);
        if ((int)$context->id !== (int)$coursecontext->id) {
            throw new \invalid_parameter_exception('Grade context does not match.');
        }
        require_capability('moodle/grade:edit', $coursecontext, $actor->id);
        $user = $DB->get_record('user', ['id' => $payload['userExternalId']], '*', MUST_EXIST);
        if ($user->deleted || $user->suspended) {
            throw new \invalid_parameter_exception('Grade user is unavailable.');
        }
        $ok = $gradeitem->update_final_grade(
            $user->id,
            $payload['grade'],
            'local_nilelearn',
            $payload['feedback'] ?? '',
            FORMAT_HTML,
            $actor->id
        );
        if (!$ok) {
            throw new \moodle_exception('cannotupdategrade', 'grades');
        }
        $grade = \grade_grade::fetch(['itemid' => $gradeitemid, 'userid' => $user->id]);
        $record = $DB->get_record('grade_items', ['id' => $gradeitemid], '*', MUST_EXIST);
        return provider_record::result('grade_item', $record, [
            'userExternalId' => (string)$user->id,
            'gradeExternalId' => $grade ? (string)$grade->id : '',
            'finalGrade' => $grade ? (float)$grade->finalgrade : null,
        ]);
    }

    public static function update_completion(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->libdir . '/completionlib.php');

        $cmid = provider_record::external_id($targetexternalid, 'Activity');
        [$course, $cm] = get_course_and_cm_from_cmid($cmid);
        $modulecontext = \context_module::instance($cmid);
        if ((int)$context->id !== (int)$modulecontext->id) {
            throw new \invalid_parameter_exception('Completion context does not match.');
        }
        $record = $DB->get_record('course_modules', ['id' => $cmid], '*', MUST_EXIST);
        provider_record::require_version($record, $expectedproviderversion);
        require_capability('moodle/course:overridecompletion', $modulecontext, $actor->id);
        $user = $DB->get_record('user', ['id' => $payload['userExternalId']], '*', MUST_EXIST);
        $completion = new \completion_info($course);
        $completion->update_state($cm, $payload['state'], $user->id, true);
        $data = $completion->get_data($cm, false, $user->id);
        $record = $DB->get_record('course_modules', ['id' => $cmid], '*', MUST_EXIST);
        return provider_record::result('activity', $record, [
            'courseModuleExternalId' => (string)$cmid,
            'userExternalId' => (string)$user->id,
            'state' => (int)$data->completionstate,
        ]);
    }
}
