<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn;

use local_nilelearn\local\command_service;
use local_nilelearn\local\provider_record;

defined('MOODLE_INTERNAL') || die();

final class command_service_test extends \advanced_testcase {
    public function test_actor_capability_command_is_idempotent(): void {
        global $DB;

        $this->resetAfterTest();
        $transport = $this->getDataGenerator()->create_user();
        $actor = $this->getDataGenerator()->create_user();
        $course = $this->getDataGenerator()->create_course([
            'numsections' => 2,
            'visible' => 1,
        ]);
        $editingteacher = $DB->get_record('role', ['shortname' => 'editingteacher'], '*', MUST_EXIST);
        $manager = $DB->get_record('role', ['shortname' => 'manager'], '*', MUST_EXIST);
        $coursecontext = \context_course::instance($course->id);
        role_assign($editingteacher->id, $actor->id, $coursecontext->id);
        role_assign($manager->id, $transport->id, \context_system::instance()->id);
        assign_capability(
            'local/nilelearn:transport',
            CAP_ALLOW,
            $manager->id,
            \context_system::instance()->id,
            true
        );
        $this->setUser($transport);

        $section = $DB->get_record(
            'course_sections',
            ['course' => $course->id, 'section' => 1],
            '*',
            MUST_EXIST
        );
        $payloadjson = '{"visible":false}';
        $request = [
            'protocolversion' => '1.0',
            'operation' => 'section.visibility',
            'idempotencykey' => 'phase6l.section.synthetic.001',
            'payloadhash' => hash('sha256', $payloadjson),
            'expectedproviderversion' => provider_record::version($section),
            'actoruserid' => $actor->id,
            'targetcontextid' => $coursecontext->id,
            'targetexternalid' => (string)$section->id,
            'commanduuid' => 'd6100000-0000-4000-8000-000000000001',
            'payloadjson' => $payloadjson,
        ];

        $first = command_service::execute($request);
        $second = command_service::execute($request);
        $this->assertSame('applied', $first['status']);
        $this->assertFalse($first['replayed']);
        $this->assertTrue($second['replayed']);
        $this->assertFalse((bool)$DB->get_field(
            'course_sections',
            'visible',
            ['id' => $section->id],
            MUST_EXIST
        ));
    }

    public function test_changed_payload_under_same_key_is_denied(): void {
        global $DB;

        $this->resetAfterTest();
        $transport = $this->getDataGenerator()->create_user();
        $actor = $this->getDataGenerator()->create_user();
        $course = $this->getDataGenerator()->create_course(['numsections' => 2]);
        $editingteacher = $DB->get_record('role', ['shortname' => 'editingteacher'], '*', MUST_EXIST);
        $manager = $DB->get_record('role', ['shortname' => 'manager'], '*', MUST_EXIST);
        $coursecontext = \context_course::instance($course->id);
        role_assign($editingteacher->id, $actor->id, $coursecontext->id);
        role_assign($manager->id, $transport->id, \context_system::instance()->id);
        assign_capability(
            'local/nilelearn:transport',
            CAP_ALLOW,
            $manager->id,
            \context_system::instance()->id,
            true
        );
        $this->setUser($transport);
        $section = $DB->get_record(
            'course_sections',
            ['course' => $course->id, 'section' => 1],
            '*',
            MUST_EXIST
        );
        $payloadjson = '{"visible":false}';
        $request = [
            'protocolversion' => '1.0',
            'operation' => 'section.visibility',
            'idempotencykey' => 'phase6l.section.synthetic.002',
            'payloadhash' => hash('sha256', $payloadjson),
            'expectedproviderversion' => provider_record::version($section),
            'actoruserid' => $actor->id,
            'targetcontextid' => $coursecontext->id,
            'targetexternalid' => (string)$section->id,
            'commanduuid' => 'd6100000-0000-4000-8000-000000000002',
            'payloadjson' => $payloadjson,
        ];
        command_service::execute($request);
        $request['payloadjson'] = '{"visible":true}';
        $request['payloadhash'] = hash('sha256', $request['payloadjson']);

        $this->expectException(\invalid_parameter_exception::class);
        command_service::execute($request);
    }

    public function test_transport_draft_is_verified_and_staged_for_mapped_actor(): void {
        global $DB;

        $this->resetAfterTest();
        $transport = $this->getDataGenerator()->create_user();
        $actor = $this->getDataGenerator()->create_user();
        $course = $this->getDataGenerator()->create_course(['numsections' => 2]);
        $editingteacher = $DB->get_record('role', ['shortname' => 'editingteacher'], '*', MUST_EXIST);
        $manager = $DB->get_record('role', ['shortname' => 'manager'], '*', MUST_EXIST);
        $coursecontext = \context_course::instance($course->id);
        role_assign($editingteacher->id, $actor->id, $coursecontext->id);
        role_assign($manager->id, $transport->id, \context_system::instance()->id);
        assign_capability(
            'local/nilelearn:transport',
            CAP_ALLOW,
            $manager->id,
            \context_system::instance()->id,
            true
        );

        $contents = 'Synthetic Nile Learn resource.';
        $draftitemid = 610001;
        get_file_storage()->create_file_from_string([
            'contextid' => \context_user::instance($transport->id)->id,
            'component' => 'user',
            'filearea' => 'draft',
            'itemid' => $draftitemid,
            'filepath' => '/',
            'filename' => 'phase6l-resource.txt',
            'mimetype' => 'text/plain',
            'userid' => $transport->id,
        ], $contents);
        $this->setUser($transport);

        $payloadjson = json_encode([
            'mode' => 'create',
            'name' => 'Phase 6L resource',
            'draftItemId' => $draftitemid,
            'filename' => 'phase6l-resource.txt',
            'mimeType' => 'text/plain',
            'size' => strlen($contents),
            'sha256' => hash('sha256', $contents),
            'sectionNumber' => 1,
            'visible' => true,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $request = [
            'protocolversion' => '1.0',
            'operation' => 'resource.upsert',
            'idempotencykey' => 'phase6l.resource.synthetic.001',
            'payloadhash' => hash('sha256', $payloadjson),
            'expectedproviderversion' => provider_record::version($course),
            'actoruserid' => $actor->id,
            'targetcontextid' => $coursecontext->id,
            'targetexternalid' => (string)$course->id,
            'commanduuid' => 'd6100000-0000-4000-8000-000000000003',
            'payloadjson' => $payloadjson,
        ];

        $result = command_service::execute($request);
        $resultdata = json_decode($result['resultJson'], true, 16, JSON_THROW_ON_ERROR);
        $cmid = (int)$resultdata['courseModuleExternalId'];
        $modulecontext = \context_module::instance($cmid);
        $resourcefiles = get_file_storage()->get_area_files(
            $modulecontext->id,
            'mod_resource',
            'content',
            0,
            'id',
            false
        );

        $this->assertSame('applied', $result['status']);
        $this->assertCount(1, $resourcefiles);
        $this->assertSame('phase6l-resource.txt', reset($resourcefiles)->get_filename());
        $this->assertEmpty(get_file_storage()->get_area_files(
            \context_user::instance($transport->id)->id,
            'user',
            'draft',
            $draftitemid,
            'id',
            false
        ));
        $this->assertEmpty(get_file_storage()->get_area_files(
            \context_user::instance($actor->id)->id,
            'user',
            'draft',
            $draftitemid,
            'id',
            false
        ));
    }
}
