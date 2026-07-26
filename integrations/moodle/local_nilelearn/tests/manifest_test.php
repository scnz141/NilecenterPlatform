<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn;

use local_nilelearn\local\manifest;

defined('MOODLE_INTERNAL') || die();

final class manifest_test extends \advanced_testcase {
    public function test_manifest_has_exact_closed_contract(): void {
        $export = manifest::export();
        $this->assertSame('local_nilelearn', $export['component']);
        $this->assertSame('1.0', $export['protocolVersion']);
        $this->assertCount(19, $export['operations']);
        $this->assertCount(6, $export['nativeLaunchKinds']);
        $this->assertSame(
            [
                'delivery_course.clone',
                'delivery_course.archive',
                'delivery_course.restore',
                'section.upsert',
                'section.reorder',
                'section.visibility',
                'page.upsert',
                'book.upsert',
                'url.upsert',
                'resource.upsert',
                'resource.archive',
                'assignment.upsert',
                'assignment.archive',
                'quiz_shell.upsert',
                'quiz.archive',
                'question.upsert',
                'question.move',
                'grade.update',
                'completion.update',
            ],
            array_column($export['operations'], 'name')
        );
    }

    public function test_unknown_operation_fails_closed(): void {
        $this->expectException(\invalid_parameter_exception::class);
        manifest::operation_capability('core.call_any_function');
    }
}
