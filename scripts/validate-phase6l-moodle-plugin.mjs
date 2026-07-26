import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = relative =>
  readFileSync(
    path.join(root, "integrations/moodle/local_nilelearn", relative),
    "utf8"
  );
const manifest = JSON.parse(
  readFileSync(
    path.join(
      root,
      "docs/integrations/local_nilelearn-capability-manifest.v1.json"
    ),
    "utf8"
  )
);
const requiredFiles = [
  "version.php",
  "db/access.php",
  "db/install.xml",
  "db/services.php",
  "classes/local/manifest.php",
  "classes/local/command_service.php",
  "classes/local/operation_handler.php",
  "classes/local/operation_payload.php",
  "classes/local/provider_record.php",
  "classes/local/delivery_course_operations.php",
  "classes/local/section_operations.php",
  "classes/local/activity_operations.php",
  "classes/local/assessment_operations.php",
  "classes/local/outcome_operations.php",
  "classes/external/get_manifest.php",
  "classes/external/execute_command.php",
  "classes/external/get_command_result.php",
  "classes/privacy/provider.php",
  "settings.php",
  "launch.php",
  "tests/manifest_test.php",
  "tests/operation_payload_test.php",
  "tests/provider_record_test.php",
  "tests/command_service_test.php",
];

for (const file of requiredFiles) {
  if (
    !existsSync(path.join(root, "integrations/moodle/local_nilelearn", file))
  ) {
    throw new Error(`local_nilelearn is missing ${file}`);
  }
}

const services = plugin("db/services.php");
for (const name of [
  "local_nilelearn_get_manifest",
  "local_nilelearn_execute_command",
  "local_nilelearn_get_command_result",
]) {
  if (!services.includes(name)) throw new Error(`Missing service ${name}`);
}
if (
  !services.includes("'restrictedusers' => 1") ||
  !services.includes("'enabled' => 0")
) {
  throw new Error("Moodle service must install restricted and disabled.");
}

const phpManifest = plugin("classes/local/manifest.php");
const version = plugin("version.php");
const implementedVersion = phpManifest.match(
  /PLUGIN_VERSION\s*=\s*'([^']+)'/
)?.[1];
const releaseVersion = version.match(/\$plugin->release\s*=\s*'([^']+)'/)?.[1];
if (
  !implementedVersion ||
  !releaseVersion ||
  implementedVersion !== releaseVersion
) {
  throw new Error(
    "Moodle plugin release and capability manifest versions differ."
  );
}
for (const operation of manifest.operations) {
  if (
    !phpManifest.includes(
      `'${operation.name}' => '${operation.requiredCapability}'`
    )
  ) {
    throw new Error(`PHP manifest differs for ${operation.name}`);
  }
}
for (const kind of manifest.nativeLaunchKinds) {
  if (!phpManifest.includes(`'${kind}'`)) {
    throw new Error(`PHP manifest omits launch kind ${kind}`);
  }
}
for (const unsafe of [
  "core.call_any_function",
  "wsfunction",
  "wstoken",
  "authorization",
]) {
  if (phpManifest.includes(unsafe)) {
    throw new Error(`Manifest contains unsafe passthrough marker ${unsafe}`);
  }
}

const commandService = plugin("classes/local/command_service.php");
for (const marker of [
  "require_capability(",
  "manifest::operation_capability",
  "idempotencykey",
  "payloadhash",
  "start_delegated_transaction",
  "operation_handler::execute",
]) {
  if (!commandService.includes(marker)) {
    throw new Error(`Command service is missing ${marker}`);
  }
}

const operationHandler = plugin("classes/local/operation_handler.php");
for (const operation of manifest.operations) {
  if (!operationHandler.includes(`'${operation.name}' =>`)) {
    throw new Error(`Operation handler omits ${operation.name}`);
  }
}
if (
  !operationHandler.includes("operation_payload::validate") ||
  !commandService.includes("\\core\\session\\manager::set_user($actor)") ||
  !commandService.includes("(int)$transportuser->id") ||
  !commandService.includes("hash('sha256', $request['payloadjson'])")
) {
  throw new Error("Moodle execution boundary is incomplete.");
}

const activityOperations = plugin("classes/local/activity_operations.php");
for (const marker of [
  "stage_validated_draft_file",
  "\\context_user::instance($transportuserid)",
  "\\context_user::instance($actor->id)",
  "create_file_from_storedfile",
  "Mapped actor draft item is already in use.",
]) {
  if (!activityOperations.includes(marker)) {
    throw new Error(`Moodle resource upload boundary is missing ${marker}`);
  }
}

const contractHash = crypto
  .createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex");
console.log(
  JSON.stringify(
    {
      phase: "6L.1",
      component: manifest.component,
      pluginVersion: implementedVersion,
      operations: manifest.operations.length,
      nativeLaunchKinds: manifest.nativeLaunchKinds.length,
      contractHash,
      serviceEnabledByDefault: false,
      operationExecutionImplemented: true,
      operationExecutionAccepted: false,
    },
    null,
    2
  )
);
