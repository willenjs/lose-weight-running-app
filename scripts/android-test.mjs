// Runs the phone and watch JVM unit tests.
import { run, gradlew } from './android-env.mjs';

run(gradlew, [':app:testDebugUnitTest', ':wear:testDebugUnitTest'], 'android');
