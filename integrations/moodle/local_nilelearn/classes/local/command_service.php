<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class command_service {
    private const IDEMPOTENCY_PATTERN = '/^[a-z0-9][a-z0-9._:-]{7,127}$/';
    private const HASH_PATTERN = '/^[a-f0-9]{64}$/';
    private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
    private const VERSION_PATTERN = '/^[a-z0-9][a-z0-9._:+-]{0,79}$/i';
    private const FORBIDDEN_KEYS = '/^(password|secret|api[_-]?key|token|authorization|cookie|set-cookie|wstoken)$/i';

    public static function execute(array $request): array {
        global $DB, $USER;

        self::validate_request($request);
        require_capability('local/nilelearn:transport', \context_system::instance());

        $context = \context::instance_by_id((int)$request['targetcontextid'], MUST_EXIST);
        $actor = $DB->get_record('user', ['id' => (int)$request['actoruserid']], '*', MUST_EXIST);
        if (!empty($actor->deleted) || !empty($actor->suspended)) {
            throw new \required_capability_exception(
                $context,
                manifest::operation_capability($request['operation']),
                'nopermissions',
                ''
            );
        }
        require_capability(
            manifest::operation_capability($request['operation']),
            $context,
            $actor->id
        );

        $lockfactory = \core\lock\lock_config::get_lock_factory('local_nilelearn');
        $lock = $lockfactory->get_lock('command:' . $request['idempotencykey'], 10);
        if (!$lock) {
            throw new \moodle_exception('locktimeout', 'error');
        }

        try {
            $existing = $DB->get_record(
                'local_nilelearn_command',
                ['idempotencykey' => $request['idempotencykey']]
            );
            if ($existing) {
                if ($existing->commanduuid !== $request['commanduuid']
                        || $existing->payloadhash !== $request['payloadhash']
                        || $existing->operation !== $request['operation']) {
                    throw new \invalid_parameter_exception(
                        'Idempotency key was already used with different command data.'
                    );
                }
                return self::record_to_result($existing, true);
            }

            $transaction = $DB->start_delegated_transaction();
            $now = time();
            $record = (object)[
                'commanduuid' => $request['commanduuid'],
                'idempotencykey' => $request['idempotencykey'],
                'payloadhash' => $request['payloadhash'],
                'operation' => $request['operation'],
                'actoruserid' => $actor->id,
                'contextid' => $context->id,
                'targetexternalid' => $request['targetexternalid'] ?: null,
                'status' => 'processing',
                'providerversion' => null,
                'resultjson' => null,
                'timecreated' => $now,
                'timemodified' => $now,
            ];
            $record->id = $DB->insert_record('local_nilelearn_command', $record);
            $payload = json_decode($request['payloadjson'], true, 64, JSON_THROW_ON_ERROR);
            $transportuser = $USER;
            \core\session\manager::set_user($actor);
            try {
                $result = operation_handler::execute(
                    $request['operation'],
                    $payload,
                    $context,
                    $actor,
                    $request['targetexternalid'] ?: null,
                    $request['expectedproviderversion'],
                    (int)$transportuser->id
                );
            } finally {
                \core\session\manager::set_user($transportuser);
            }
            $record->status = 'applied';
            $record->providerversion = self::provider_version($result);
            $record->resultjson = json_encode(
                $result,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            );
            $record->timemodified = time();
            $DB->update_record('local_nilelearn_command', $record);
            $transaction->allow_commit();
            return self::record_to_result($record, false);
        } finally {
            $lock->release();
        }
    }

    public static function result(string $commanduuid): array {
        global $DB;

        require_capability('local/nilelearn:transport', \context_system::instance());
        if (!preg_match(self::UUID_PATTERN, $commanduuid)) {
            throw new \invalid_parameter_exception('Command UUID is invalid.');
        }
        $record = $DB->get_record(
            'local_nilelearn_command',
            ['commanduuid' => $commanduuid],
            '*',
            MUST_EXIST
        );
        return self::record_to_result($record, true);
    }

    private static function validate_request(array $request): void {
        $expectedkeys = [
            'protocolversion',
            'operation',
            'idempotencykey',
            'payloadhash',
            'expectedproviderversion',
            'actoruserid',
            'targetcontextid',
            'targetexternalid',
            'commanduuid',
            'payloadjson',
        ];
        $actualkeys = array_keys($request);
        sort($expectedkeys);
        sort($actualkeys);
        if ($expectedkeys !== $actualkeys
                || $request['protocolversion'] !== manifest::PROTOCOL_VERSION
                || !preg_match(self::IDEMPOTENCY_PATTERN, $request['idempotencykey'])
                || !preg_match(self::HASH_PATTERN, $request['payloadhash'])
                || !preg_match(self::VERSION_PATTERN, $request['expectedproviderversion'])
                || !preg_match(self::UUID_PATTERN, $request['commanduuid'])
                || !is_int($request['actoruserid'])
                || $request['actoruserid'] <= 0
                || !is_int($request['targetcontextid'])
                || $request['targetcontextid'] <= 0
                || !is_string($request['targetexternalid'])
                || strlen($request['targetexternalid']) > 80
                || strlen($request['payloadjson']) > 65536
                || hash('sha256', $request['payloadjson']) !== $request['payloadhash']) {
            throw new \invalid_parameter_exception('Nile Learn command request is invalid.');
        }
        manifest::operation_capability($request['operation']);
        $payload = json_decode($request['payloadjson'], true, 64, JSON_THROW_ON_ERROR);
        if (!is_array($payload) || array_is_list($payload) || self::contains_forbidden_key($payload)) {
            throw new \invalid_parameter_exception('Nile Learn command payload is unsafe.');
        }
    }

    private static function contains_forbidden_key(array $value): bool {
        foreach ($value as $key => $nested) {
            if (preg_match(self::FORBIDDEN_KEYS, (string)$key)) {
                return true;
            }
            if (is_array($nested) && self::contains_forbidden_key($nested)) {
                return true;
            }
        }
        return false;
    }

    private static function provider_version(array $result): string {
        $version = $result['providerVersion'] ?? null;
        if (!is_string($version) || !preg_match(self::VERSION_PATTERN, $version)) {
            throw new \invalid_parameter_exception('Provider result version is invalid.');
        }
        return $version;
    }

    private static function record_to_result(\stdClass $record, bool $replayed): array {
        return [
            'commandUuid' => $record->commanduuid,
            'operation' => $record->operation,
            'status' => $record->status,
            'providerVersion' => $record->providerversion ?? '',
            'resultJson' => $record->resultjson ?? '{}',
            'replayed' => $replayed,
        ];
    }
}
