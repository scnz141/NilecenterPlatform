<?php
// This file is part of Moodle - http://moodle.org/

$string['pluginname'] = 'Nile Learn integration';
$string['privacy:metadata'] = 'Nile Learn stores command identifiers, actor identifiers, target contexts, and provider results to provide idempotent integration evidence.';
$string['privacy:metadata:local_nilelearn_command'] = 'Provider-side command evidence.';
$string['privacy:metadata:local_nilelearn_command:commanduuid'] = 'The originating Nile Learn command identifier.';
$string['privacy:metadata:local_nilelearn_command:idempotencykey'] = 'The command replay protection key.';
$string['privacy:metadata:local_nilelearn_command:operation'] = 'The operation requested by Nile Learn.';
$string['privacy:metadata:local_nilelearn_command:actoruserid'] = 'The mapped Moodle user whose capability authorized the operation.';
$string['privacy:metadata:local_nilelearn_command:contextid'] = 'The Moodle context where the capability was checked.';
$string['privacy:metadata:local_nilelearn_command:status'] = 'The provider execution status.';
$string['privacy:metadata:local_nilelearn_command:resultjson'] = 'The bounded provider result.';
$string['nilelearn:transport'] = 'Use the Nile Learn command transport';
$string['operationnotimplemented'] = 'This Nile Learn operation is not implemented by the installed plugin version.';
$string['providerconflict'] = 'The Moodle record changed. Expected version {$a->expected}, current version {$a->actual}.';
$string['nilebaseurl'] = 'Nile Learn base URL';
$string['nilebaseurl_desc'] = 'The exact HTTPS Nile Learn server used for single-use launch exchange.';
$string['launchexchangesecret'] = 'Launch exchange secret';
$string['launchexchangesecret_desc'] = 'A dedicated secret shared only by Moodle and the Nile Learn launch exchange endpoint.';
$string['launchconfigurationmissing'] = 'Nile Learn launch exchange is not configured.';
$string['launchconfigurationunsafe'] = 'Nile Learn launch exchange configuration is unsafe.';
$string['launchexchangefailed'] = 'The Nile Learn launch ticket could not be exchanged.';
$string['launchexchangeinvalid'] = 'The Nile Learn launch exchange response is invalid.';
$string['launchkindinvalid'] = 'The requested Nile Learn launch kind is invalid.';
