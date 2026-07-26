<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn;

use local_nilelearn\local\operation_payload;

defined('MOODLE_INTERNAL') || die();

final class operation_payload_test extends \advanced_testcase {
    public function test_closed_page_payload_is_accepted(): void {
        $payload = [
            'mode' => 'create',
            'name' => 'NILE-6L synthetic page',
            'content' => '<p>Synthetic only</p>',
            'sectionNumber' => 1,
            'visible' => false,
        ];
        $this->assertSame(
            $payload,
            operation_payload::validate('page.upsert', $payload)
        );
    }

    public function test_unknown_payload_field_is_denied(): void {
        $this->expectException(\invalid_parameter_exception::class);
        operation_payload::validate('page.upsert', [
            'mode' => 'create',
            'name' => 'NILE-6L synthetic page',
            'content' => '<p>Synthetic only</p>',
            'wstoken' => 'forbidden',
        ]);
    }

    public function test_oversize_resource_is_denied(): void {
        $this->expectException(\invalid_parameter_exception::class);
        operation_payload::validate('resource.upsert', [
            'mode' => 'create',
            'name' => 'NILE-6L synthetic file',
            'draftItemId' => 42,
            'filename' => 'synthetic.pdf',
            'mimeType' => 'application/pdf',
            'size' => 104857601,
            'sha256' => str_repeat('a', 64),
        ]);
    }
}
