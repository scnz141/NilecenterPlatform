<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\privacy;

use core_privacy\local\metadata\collection;
use core_privacy\local\request\approved_contextlist;
use core_privacy\local\request\approved_userlist;
use core_privacy\local\request\contextlist;
use core_privacy\local\request\core_userlist_provider;
use core_privacy\local\request\plugin\provider as plugin_provider;
use core_privacy\local\request\transform;
use core_privacy\local\request\userlist;
use core_privacy\local\request\writer;

defined('MOODLE_INTERNAL') || die();

final class provider implements
    \core_privacy\local\metadata\provider,
    plugin_provider,
    core_userlist_provider
{
    public static function get_metadata(collection $collection): collection {
        $collection->add_database_table(
            'local_nilelearn_command',
            [
                'commanduuid' => 'privacy:metadata:local_nilelearn_command:commanduuid',
                'idempotencykey' => 'privacy:metadata:local_nilelearn_command:idempotencykey',
                'operation' => 'privacy:metadata:local_nilelearn_command:operation',
                'actoruserid' => 'privacy:metadata:local_nilelearn_command:actoruserid',
                'contextid' => 'privacy:metadata:local_nilelearn_command:contextid',
                'status' => 'privacy:metadata:local_nilelearn_command:status',
                'resultjson' => 'privacy:metadata:local_nilelearn_command:resultjson',
            ],
            'privacy:metadata:local_nilelearn_command'
        );
        return $collection;
    }

    public static function get_contexts_for_userid(int $userid): contextlist {
        $contextlist = new contextlist();
        $contextlist->add_from_sql(
            'SELECT DISTINCT contextid FROM {local_nilelearn_command} WHERE actoruserid = :userid',
            ['userid' => $userid]
        );
        return $contextlist;
    }

    public static function get_users_in_context(userlist $userlist): void {
        $userlist->add_from_sql(
            'actoruserid',
            'SELECT actoruserid FROM {local_nilelearn_command} WHERE contextid = :contextid',
            ['contextid' => $userlist->get_context()->id]
        );
    }

    public static function export_user_data(approved_contextlist $contextlist): void {
        global $DB;

        $userid = $contextlist->get_user()->id;
        foreach ($contextlist->get_contexts() as $context) {
            $records = $DB->get_records(
                'local_nilelearn_command',
                ['actoruserid' => $userid, 'contextid' => $context->id],
                'timecreated ASC'
            );
            $rows = [];
            foreach ($records as $record) {
                $rows[] = (object)[
                    'command_uuid' => $record->commanduuid,
                    'operation' => $record->operation,
                    'status' => $record->status,
                    'time_created' => transform::datetime($record->timecreated),
                ];
            }
            if ($rows) {
                writer::with_context($context)->export_data(
                    [get_string('pluginname', 'local_nilelearn')],
                    (object)['commands' => $rows]
                );
            }
        }
    }

    public static function delete_data_for_all_users_in_context(\context $context): void {
        global $DB;
        $DB->delete_records('local_nilelearn_command', ['contextid' => $context->id]);
    }

    public static function delete_data_for_user(approved_contextlist $contextlist): void {
        global $DB;
        foreach ($contextlist->get_contexts() as $context) {
            $DB->delete_records(
                'local_nilelearn_command',
                ['actoruserid' => $contextlist->get_user()->id, 'contextid' => $context->id]
            );
        }
    }

    public static function delete_data_for_users(approved_userlist $userlist): void {
        global $DB;
        $userids = $userlist->get_userids();
        if (!$userids) {
            return;
        }
        [$usersql, $params] = $DB->get_in_or_equal($userids, SQL_PARAMS_NAMED);
        $params['contextid'] = $userlist->get_context()->id;
        $DB->delete_records_select(
            'local_nilelearn_command',
            "contextid = :contextid AND actoruserid {$usersql}",
            $params
        );
    }
}
