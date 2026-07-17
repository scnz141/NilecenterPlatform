# M2C-R Moodle Fixtures

Generate fake-only SCORM 1.2 and content-only H5P TrueFalse packages:

```sh
node scripts/moodle-fixtures/generate-m2cr-fixtures.mjs \
  --h5p-major 1 \
  --h5p-minor 8
```

The version values must match the installed `H5P.TrueFalse` library. There is
no default. They can instead be supplied through
`MOODLE_FIXTURE_H5P_TRUEFALSE_MAJOR_VERSION` and
`MOODLE_FIXTURE_H5P_TRUEFALSE_MINOR_VERSION`. CLI values take precedence.

Packages are written only to the gitignored
`output/moodle-fixtures/m2c-r/current/` directory. Use
`--build-name <lowercase-name>` for an isolated evidence subdirectory. The
generator requires the system Info-ZIP command with `-X`, `-0`, and `-D`
support; it uses fixed timestamps, modes, file order, and stored entries so two
builds with the same inputs are byte-identical.

Run the focused tests with:

```sh
node --test scripts/moodle-fixtures/generate-m2cr-fixtures.test.mjs
```
