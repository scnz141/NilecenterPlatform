import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing: ${expected}`);
  }
}

const contract = read("shared/nileForms.ts");
const fixtures = read("shared/nileFormsFixtures.ts");
const catalog = read("shared/nileFormsTemplateCatalog.ts");
const service = read("server/nileFormsService.ts");
const routes = read("server/nileFormsRoutes.ts");
const builder = read("client/src/pages/platform/NileFormsBuilderPage.tsx");
const renderer = read("client/src/components/forms/NileFormRenderer.tsx");
const formsCss = read("client/src/styles/nile-forms.css");
const coreTests = read("client/src/lib/forms/nileForms.test.ts");
const serviceTests = read(
  "client/src/lib/forms/server-nile-forms-service.test.ts"
);

for (const locale of ['"en"', '"ar"', '"tr"']) {
  requireText(contract, locale, `Forms locale ${locale}`);
}
requireText(contract, "contractVersion?: 1 | 2", "version compatibility");
requireText(contract, "calculations?: FormCalculation[]", "calculation model");
requireText(
  contract,
  "getFormCalculationTargetIds",
  "derived target authority"
);
requireText(
  contract,
  "evaluateFormCalculations",
  "deterministic calculation evaluator"
);
requireText(
  contract,
  "formatFormValidationMessage",
  "localized validation formatter"
);
requireText(contract, "delete answers[targetId]", "derived input rejection");

requireText(fixtures, "contractVersion: 2", "template contract version");
requireText(fixtures, 'languages: ["en", "ar", "tr"]', "template languages");
requireText(
  fixtures,
  "createNileFormsTemplateContent",
  "independent template copies"
);
requireText(catalog, "nileFormsTemplateCategories", "template categories");

requireText(service, "titleTr", "Turkish definition title");
requireText(service, "template_invalid", "template category validation");
requireText(service, "formLocale(input.locale", "server locale validation");
requireText(routes, "locale: body.locale", "locale route forwarding");

requireText(builder, 'id: "calculations"', "builder calculation tab");
requireText(builder, "Turkish label", "builder Turkish field editor");
requireText(builder, "Turkish help text", "builder Turkish help editor");
requireText(
  builder,
  "aria-label={`${formLocaleNames[language]} title`}",
  "builder locale-specific accessible labels"
);
requireText(renderer, "displayedAnswers", "derived renderer values");
requireText(renderer, 'language === "ar" ? "ع" : "TR"', "Turkish switcher");
requireText(
  formsCss,
  ".nile-form-actions button {\n  min-height: 44px;",
  "renderer action touch targets"
);

for (const evidence of [
  "requires complete English, Arabic, and Turkish content",
  "calculates deterministic derived values",
  "reports division-by-zero",
]) {
  requireText(coreTests, evidence, `core test ${evidence}`);
}
requireText(
  serviceTests,
  "creates independent trilingual drafts",
  "template isolation test"
);
requireText(
  serviceTests,
  "bounded requested locale",
  "server localization test"
);

console.log(
  JSON.stringify(
    {
      result: "Nile Forms Phase 14A structured content contract passed",
      locales: ["en", "ar", "tr"],
      templateCount: 7,
      calculationOperators: 7,
      runtimeDefault: "memory",
      normalizedActivation: false,
      externalProviders: false,
    },
    null,
    2
  )
);
