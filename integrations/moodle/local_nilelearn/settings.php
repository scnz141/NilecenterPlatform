<?php
// This file is part of Moodle - http://moodle.org/

defined('MOODLE_INTERNAL') || die();

if ($hassiteconfig) {
    $settings = new admin_settingpage(
        'local_nilelearn',
        get_string('pluginname', 'local_nilelearn')
    );
    $settings->add(new admin_setting_configtext(
        'local_nilelearn/nilebaseurl',
        get_string('nilebaseurl', 'local_nilelearn'),
        get_string('nilebaseurl_desc', 'local_nilelearn'),
        '',
        PARAM_URL
    ));
    $settings->add(new admin_setting_configpasswordunmask(
        'local_nilelearn/launchexchangesecret',
        get_string('launchexchangesecret', 'local_nilelearn'),
        get_string('launchexchangesecret_desc', 'local_nilelearn'),
        ''
    ));
    $ADMIN->add('localplugins', $settings);
}
