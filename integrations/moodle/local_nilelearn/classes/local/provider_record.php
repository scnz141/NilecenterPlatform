<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class provider_record {
    public static function external_id(?string $value, string $label): int {
        if ($value === null || !preg_match('/^[1-9][0-9]{0,18}$/', $value)) {
            throw new \invalid_parameter_exception("{$label} mapping is invalid.");
        }
        return (int)$value;
    }

    public static function version(\stdClass $record): string {
        $modified = isset($record->timemodified) ? (int)$record->timemodified : 0;
        $id = isset($record->id) ? (int)$record->id : 0;
        if ($modified <= 0) {
            $normalized = get_object_vars($record);
            ksort($normalized);
            $modified = substr(
                hash('sha256', json_encode(
                    $normalized,
                    JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                )),
                0,
                16
            );
            return sprintf('m405-%d-%s', $id, $modified);
        }
        return sprintf('m405-%d-%d', $id, $modified);
    }

    public static function require_version(\stdClass $record, string $expected): void {
        if ($expected === 'new') {
            return;
        }
        $actual = self::version($record);
        if (!hash_equals($actual, $expected)) {
            throw new \moodle_exception(
                'providerconflict',
                'local_nilelearn',
                '',
                (object)['expected' => $expected, 'actual' => $actual]
            );
        }
    }

    public static function result(
        string $entitytype,
        \stdClass $record,
        array $extra = []
    ): array {
        return array_merge([
            'entityType' => $entitytype,
            'externalId' => (string)$record->id,
            'providerVersion' => self::version($record),
        ], $extra);
    }
}
