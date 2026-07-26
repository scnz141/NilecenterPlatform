<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_single_structure;
use core_external\external_value;
use local_nilelearn\local\command_service;

defined('MOODLE_INTERNAL') || die();

final class get_command_result extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([
            'commanduuid' => new external_value(PARAM_ALPHANUMEXT, 'Originating command UUID'),
        ]);
    }

    public static function execute(string $commanduuid): array {
        $params = self::validate_parameters(
            self::execute_parameters(),
            ['commanduuid' => $commanduuid]
        );
        return command_service::result($params['commanduuid']);
    }

    public static function execute_returns(): external_single_structure {
        return self::result_structure();
    }

    public static function result_structure(): external_single_structure {
        return new external_single_structure([
            'commandUuid' => new external_value(PARAM_RAW_TRIMMED, 'Command UUID'),
            'operation' => new external_value(PARAM_RAW_TRIMMED, 'Operation'),
            'status' => new external_value(PARAM_ALPHAEXT, 'Execution status'),
            'providerVersion' => new external_value(PARAM_RAW_TRIMMED, 'Provider version'),
            'resultJson' => new external_value(PARAM_RAW, 'Bounded provider result JSON'),
            'replayed' => new external_value(PARAM_BOOL, 'Whether this is a replayed result'),
        ]);
    }
}
