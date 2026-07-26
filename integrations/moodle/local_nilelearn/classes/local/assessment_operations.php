<?php
// This file is part of Moodle - http://moodle.org/

namespace local_nilelearn\local;

defined('MOODLE_INTERNAL') || die();

final class assessment_operations {
    public static function upsert_assignment(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        $fields = [
            'alwaysshowdescription' => 1,
            'submissiondrafts' => 1,
            'requiresubmissionstatement' => 0,
            'sendnotifications' => 0,
            'sendstudentnotifications' => 1,
            'sendlatenotifications' => 0,
            'allowsubmissionsfromdate' => $payload['availableFrom'] ?? 0,
            'duedate' => $payload['dueAt'] ?? 0,
            'cutoffdate' => $payload['cutoffAt'] ?? 0,
            'gradingduedate' => 0,
            'grade' => $payload['maximumGrade'] ?? 100,
            'teamsubmission' => 0,
            'requireallteammemberssubmit' => 0,
            'teamsubmissiongroupingid' => 0,
            'blindmarking' => 0,
            'attemptreopenmethod' => 'untilpass',
            'maxattempts' => 1,
            'markingworkflow' => 0,
            'markingallocation' => 0,
            'markinganonymous' => 0,
            'activityformat' => FORMAT_HTML,
            'timelimit' => 0,
            'submissionattachments' => 0,
        ];
        return activity_operations::upsert_module(
            'assign',
            $payload,
            $fields,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function archive_assignment(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        return activity_operations::archive_module(
            'assign',
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function upsert_quiz(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG;
        require_once($CFG->dirroot . '/mod/quiz/locallib.php');
        $fields = [
            'timeopen' => $payload['opensAt'] ?? 0,
            'timeclose' => $payload['closesAt'] ?? 0,
            'timelimit' => $payload['timeLimitSeconds'] ?? 0,
            'preferredbehaviour' => 'deferredfeedback',
            'attempts' => 0,
            'attemptonlast' => 0,
            'grademethod' => QUIZ_GRADEHIGHEST,
            'decimalpoints' => 2,
            'questiondecimalpoints' => -1,
            'questionsperpage' => 1,
            'shuffleanswers' => 1,
            'sumgrades' => 0,
            'grade' => $payload['maximumGrade'] ?? 100,
            'overduehandling' => 'autosubmit',
            'graceperiod' => 86400,
            'quizpassword' => '',
            'subnet' => '',
            'browsersecurity' => '',
            'delay1' => 0,
            'delay2' => 0,
            'showuserpicture' => 0,
            'showblocks' => 0,
            'navmethod' => QUIZ_NAVMETHOD_FREE,
        ];
        foreach (['during', 'immediately', 'open', 'closed'] as $phase) {
            foreach ([
                'attempt', 'correctness', 'maxmarks', 'marks', 'specificfeedback',
                'generalfeedback', 'rightanswer', 'overallfeedback',
            ] as $review) {
                $fields[$review . $phase] = ($review === 'overallfeedback' && $phase === 'during') ? 0 : 1;
            }
        }
        return activity_operations::upsert_module(
            'quiz',
            $payload,
            $fields,
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function archive_quiz(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        return activity_operations::archive_module(
            'quiz',
            $context,
            $actor,
            $targetexternalid,
            $expectedproviderversion
        );
    }

    public static function upsert_question(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->libdir . '/questionlib.php');

        $categoryid = (int)($payload['categoryExternalId'] ?? 0);
        if ($categoryid <= 0) {
            throw new \invalid_parameter_exception('Question category mapping is required.');
        }
        $category = $DB->get_record('question_categories', ['id' => $categoryid], '*', MUST_EXIST);
        if ((int)$category->contextid !== (int)$context->id) {
            throw new \invalid_parameter_exception('Question category context does not match.');
        }
        require_capability('moodle/question:editall', $context, $actor->id);

        $question = new \stdClass();
        if ($payload['mode'] === 'update') {
            $questionid = provider_record::external_id($targetexternalid, 'Question');
            $question = $DB->get_record('question', ['id' => $questionid], '*', MUST_EXIST);
            provider_record::require_version($question, $expectedproviderversion);
            if ($question->qtype !== $payload['questionType']) {
                throw new \invalid_parameter_exception('Question type cannot be changed.');
            }
        } else if ($targetexternalid !== null || $expectedproviderversion !== 'new') {
            throw new \invalid_parameter_exception('New question target is invalid.');
        }

        $form = self::question_form($payload, $category);
        $question->qtype = $payload['questionType'];
        $saved = \question_bank::get_qtype($payload['questionType'])->save_question($question, $form);
        return provider_record::result('question', $saved, [
            'questionType' => $saved->qtype,
            'categoryExternalId' => (string)$saved->category,
        ]);
    }

    public static function move_question(
        array $payload,
        \context $context,
        \stdClass $actor,
        ?string $targetexternalid,
        string $expectedproviderversion
    ): array {
        global $CFG, $DB;
        require_once($CFG->libdir . '/questionlib.php');

        $questionid = provider_record::external_id($targetexternalid, 'Question');
        $question = $DB->get_record('question', ['id' => $questionid], '*', MUST_EXIST);
        provider_record::require_version($question, $expectedproviderversion);
        $destination = $DB->get_record(
            'question_categories',
            ['id' => $payload['destinationCategoryExternalId']],
            '*',
            MUST_EXIST
        );
        if ((int)$destination->contextid !== (int)$context->id) {
            throw new \invalid_parameter_exception('Question destination context does not match.');
        }
        require_capability('moodle/question:moveall', $context, $actor->id);
        question_move_questions_to_category([$questionid], $destination->id);
        $question = $DB->get_record('question', ['id' => $questionid], '*', MUST_EXIST);
        return provider_record::result('question', $question, [
            'categoryExternalId' => (string)$destination->id,
        ]);
    }

    private static function question_form(array $payload, \stdClass $category): \stdClass {
        $form = (object)[
            'category' => "{$category->id},{$category->contextid}",
            'name' => $payload['name'],
            'questiontext' => ['text' => $payload['questionText'], 'format' => FORMAT_HTML, 'itemid' => 0],
            'generalfeedback' => [
                'text' => $payload['generalFeedback'] ?? '',
                'format' => FORMAT_HTML,
                'itemid' => 0,
            ],
            'defaultmark' => $payload['defaultMark'],
            'penalty' => 0,
            'status' => \core_question\local\bank\question_version_status::QUESTION_STATUS_READY,
            'idnumber' => '',
            'hint' => [],
            'hintshownumcorrect' => [],
            'hintclearwrong' => [],
            'tags' => [],
        ];

        if ($payload['questionType'] === 'truefalse') {
            $form->correctanswer = ($payload['correctAnswer'] ?? true) ? 1 : 0;
            $form->feedbacktrue = ['text' => '', 'format' => FORMAT_HTML];
            $form->feedbackfalse = ['text' => '', 'format' => FORMAT_HTML];
        } else {
            $answers = $payload['answers'] ?? [];
            if (!$answers) {
                throw new \invalid_parameter_exception('Question answers are required.');
            }
            $form->answer = [];
            $form->fraction = [];
            $form->feedback = [];
            foreach ($answers as $answer) {
                if (is_array($answer)) {
                    $answerkeys = array_keys($answer);
                    sort($answerkeys);
                } else {
                    $answerkeys = [];
                }
                if (!is_array($answer)
                        || $answerkeys !== ['fraction', 'text']
                        || !is_string($answer['text'])
                        || (!is_int($answer['fraction']) && !is_float($answer['fraction']))
                        || $answer['fraction'] < 0
                        || $answer['fraction'] > 1) {
                    throw new \invalid_parameter_exception('Question answer is invalid.');
                }
                $form->answer[] = ['text' => $answer['text'], 'format' => FORMAT_HTML];
                $form->fraction[] = $answer['fraction'];
                $form->feedback[] = ['text' => '', 'format' => FORMAT_HTML];
            }
            if ($payload['questionType'] === 'shortanswer') {
                $form->usecase = 0;
            } else {
                $form->single = 1;
                $form->shuffleanswers = 1;
                $form->answernumbering = 'abc';
                $form->correctfeedback = ['text' => '', 'format' => FORMAT_HTML];
                $form->partiallycorrectfeedback = ['text' => '', 'format' => FORMAT_HTML];
                $form->incorrectfeedback = ['text' => '', 'format' => FORMAT_HTML];
                $form->shownumcorrect = 0;
                $form->showstandardinstruction = 0;
            }
        }
        return $form;
    }
}
