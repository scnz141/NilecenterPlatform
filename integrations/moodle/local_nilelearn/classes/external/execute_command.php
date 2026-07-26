<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;
use local_nilelearn\local\command_service;

defined('MOODLE_INTERNAL') || die();

final class execute_command extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'protocolversion' => new external_value(PARAM_RAW_TRIMMED, 'Protocol version'),
            'operation' => new external_value(PARAM_RAW_TRIMMED, 'Allowlisted operation'),
            'idempotencykey' => new external_value(PARAM_RAW_TRIMMED, 'Replay protection key'),
            'payloadhash' => new external_value(PARAM_ALPHANUMEXT, 'SHA-256 payload hash'),
            'expectedproviderversion' => new external_value(PARAM_RAW_TRIMMED, 'Expected version'),
            'actoruserid' => new external_value(PARAM_INT, 'Mapped Moodle actor user ID'),
            'targetcontextid' => new external_value(PARAM_INT, 'Target Moodle context ID'),
            'targetexternalid' => new external_value(
                PARAM_RAW_TRIMMED,
                'Mapped target external ID',
                VALUE_DEFAULT,
                ''
            ),
            'commanduuid' => new external_value(PARAM_ALPHANUMEXT, 'Originating command UUID'),
            'payloadjson' => new external_value(PARAM_RAW, 'Canonical JSON object payload'),
        ]);
    }

    public static function execute(
        string $protocolversion,
        string $operation,
        string $idempotencykey,
        string $payloadhash,
        string $expectedproviderversion,
        int $actoruserid,
        int $targetcontextid,
        string $targetexternalid,
        string $commanduuid,
        string $payloadjson
    ): array {
        $params = self::validate_parameters(self::execute_parameters(), compact(
            'protocolversion',
            'operation',
            'idempotencykey',
            'payloadhash',
            'expectedproviderversion',
            'actoruserid',
            'targetcontextid',
            'targetexternalid',
            'commanduuid',
            'payloadjson'
        ));
        return command_service::execute($params);
    }

    public static function execute_returns(): external_single_structure {
        return get_command_result::result_structure();
    }
}
