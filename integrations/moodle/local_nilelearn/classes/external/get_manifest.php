<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\external;

use core_external\external_api;
use core_external\external_function_parameters;
use core_external\external_multiple_structure;
use core_external\external_single_structure;
use core_external\external_value;
use local_nilelearn\local\manifest;

defined('MOODLE_INTERNAL') || die();

final class get_manifest extends external_api {
    public static function execute_parameters(): external_function_parameters {
        return new external_function_parameters([]);
    }

    public static function execute(): array {
        require_capability('local/nilelearn:transport', \context_system::instance());
        return manifest::export();
    }

    public static function execute_returns(): external_single_structure {
        return new external_single_structure([
            'component' => new external_value(PARAM_COMPONENT, 'Plugin component'),
            'pluginVersion' => new external_value(PARAM_RAW_TRIMMED, 'Plugin version'),
            'protocolVersion' => new external_value(PARAM_RAW_TRIMMED, 'Protocol version'),
            'operations' => new external_multiple_structure(
                new external_single_structure([
                    'name' => new external_value(PARAM_RAW_TRIMMED, 'Operation name'),
                    'requiredCapability' => new external_value(PARAM_RAW_TRIMMED, 'Actor capability'),
                ])
            ),
            'nativeLaunchKinds' => new external_multiple_structure(
                new external_value(PARAM_ALPHANUMEXT, 'Native launch kind')
            ),
        ]);
    }
}
