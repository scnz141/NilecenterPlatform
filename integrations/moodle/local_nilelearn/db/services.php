<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

$functions = [
    'local_nilelearn_get_manifest' => [
        'classname' => 'local_nilelearn\external\get_manifest',
        'description' => 'Return the exact Nile Learn capability manifest.',
        'type' => 'read',
        'ajax' => false,
        'capabilities' => 'local/nilelearn:transport',
    ],
    'local_nilelearn_execute_command' => [
        'classname' => 'local_nilelearn\external\execute_command',
        'description' => 'Execute one closed, idempotent Nile Learn command.',
        'type' => 'write',
        'ajax' => false,
        'capabilities' => 'local/nilelearn:transport',
    ],
    'local_nilelearn_get_command_result' => [
        'classname' => 'local_nilelearn\external\get_command_result',
        'description' => 'Read the immutable result for a Nile Learn command.',
        'type' => 'read',
        'ajax' => false,
        'capabilities' => 'local/nilelearn:transport',
    ],
];

$services = [
    'Nile Learn command protocol 1.0' => [
        'functions' => array_keys($functions),
        'restrictedusers' => 1,
        'enabled' => 0,
        'shortname' => 'nilelearn_command_v1',
        'downloadfiles' => 1,
        'uploadfiles' => 1,
    ],
];

