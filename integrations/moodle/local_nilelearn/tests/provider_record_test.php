<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn;

use local_nilelearn\local\provider_record;

defined('MOODLE_INTERNAL') || die();

final class provider_record_test extends \advanced_testcase {
    public function test_version_uses_moodle_timestamp_when_available(): void {
        $this->assertSame(
            'm405-42-1784800000',
            provider_record::version((object)[
                'id' => 42,
                'timemodified' => 1784800000,
            ])
        );
    }

    public function test_version_is_stable_when_record_has_no_timestamp(): void {
        $record = (object)['id' => 42, 'completion' => 1, 'visible' => 1];
        $this->assertSame(
            provider_record::version($record),
            provider_record::version((object)[
                'visible' => 1,
                'completion' => 1,
                'id' => 42,
            ])
        );
        $this->assertMatchesRegularExpression(
            '/^m405-42-[a-f0-9]{16}$/',
            provider_record::version($record)
        );
    }

    public function test_changed_record_changes_fallback_version(): void {
        $before = provider_record::version(
            (object)['id' => 42, 'completion' => 0]
        );
        $after = provider_record::version(
            (object)['id' => 42, 'completion' => 1]
        );
        $this->assertNotSame($before, $after);
    }
}
