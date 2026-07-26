<?php
// This file is part of Moodle - http://moodle.org/

require_once(__DIR__ . '/../../config.php');

$ticket = required_param('ticket', PARAM_ALPHANUMEXT);
$baseurl = trim((string)get_config('local_nilelearn', 'nilebaseurl'));
$secret = trim((string)get_config('local_nilelearn', 'launchexchangesecret'));

if ($baseurl === '' || $secret === '') {
    throw new moodle_exception('launchconfigurationmissing', 'local_nilelearn');
}

$parsedbase = parse_url($baseurl);
if (!is_array($parsedbase)
        || ($parsedbase['scheme'] ?? '') !== 'https'
        || empty($parsedbase['host'])
        || isset($parsedbase['user'])
        || isset($parsedbase['pass'])
        || isset($parsedbase['query'])
        || isset($parsedbase['fragment'])) {
    throw new moodle_exception('launchconfigurationunsafe', 'local_nilelearn');
}

$client = new curl();
$client->setHeader([
    'Accept: application/json',
    'Authorization: Bearer ' . $secret,
    'Content-Type: application/json',
]);
$raw = $client->post(
    rtrim($baseurl, '/') . '/api/internal/moodle-launches/exchange',
    json_encode(['ticket' => $ticket], JSON_THROW_ON_ERROR),
    ['CURLOPT_TIMEOUT' => 10, 'CURLOPT_FOLLOWLOCATION' => false]
);
$info = $client->get_info();
if (($info['http_code'] ?? 0) !== 200) {
    throw new moodle_exception('launchexchangefailed', 'local_nilelearn');
}
$payload = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
$launch = $payload['launch'] ?? null;
if (!is_array($launch)
        || !ctype_digit((string)($launch['actorExternalId'] ?? ''))
        || !ctype_digit((string)($launch['targetExternalId'] ?? ''))
        || !is_string($launch['kind'] ?? null)
        || !is_string($launch['returnPath'] ?? null)) {
    throw new moodle_exception('launchexchangeinvalid', 'local_nilelearn');
}

$actorid = (int)$launch['actorExternalId'];
$cmid = (int)$launch['targetExternalId'];
$user = core_user::get_user($actorid, '*', MUST_EXIST);
$cm = get_coursemodule_from_id('', $cmid, 0, false, MUST_EXIST);
$context = context_module::instance($cm->id);

if ($user->deleted || $user->suspended) {
    throw new required_capability_exception($context, 'moodle/course:view', 'nopermissions', '');
}

$authoring = [
    'lesson_authoring',
    'h5p_authoring',
    'scorm_authoring',
    'video_time_authoring',
];
if (in_array($launch['kind'], $authoring, true)) {
    require_capability('moodle/course:manageactivities', $context, $user->id);
    $destination = new moodle_url('/course/modedit.php', ['update' => $cm->id, 'return' => 1]);
} else if ($launch['kind'] === 'quiz_attempt') {
    require_capability('mod/quiz:attempt', $context, $user->id);
    $destination = new moodle_url('/mod/quiz/view.php', ['id' => $cm->id]);
} else if ($launch['kind'] === 'assignment_submission') {
    require_capability('mod/assign:submit', $context, $user->id);
    $destination = new moodle_url(
        '/mod/assign/view.php',
        ['id' => $cm->id, 'action' => 'editsubmission']
    );
} else {
    throw new moodle_exception('launchkindinvalid', 'local_nilelearn');
}

complete_user_login($user);
$SESSION->wantsurl = rtrim($baseurl, '/') . $launch['returnPath'];
redirect($destination);
