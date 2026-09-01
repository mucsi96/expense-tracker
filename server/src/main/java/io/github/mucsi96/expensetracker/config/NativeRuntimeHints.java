package io.github.mucsi96.expensetracker.config;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.stream.Stream;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.aot.hint.TypeReference;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

/**
 * GraalVM native image hints for Angus Mail, which resolves the
 * DataContentHandler for each MIME type reflectively from the mailcap
 * registry. Without these hints {@code Part#getContent()} silently returns a
 * raw stream instead of the decoded String/Multipart, so bank notification
 * parsing would reject every email. Image handlers are left out on purpose:
 * they would pull AWT into the image and attachments are ignored anyway.
 */
public class NativeRuntimeHints implements RuntimeHintsRegistrar {

  @Override
  public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
    Stream.of(
        "org.eclipse.angus.mail.handlers.text_plain",
        "org.eclipse.angus.mail.handlers.text_html",
        "org.eclipse.angus.mail.handlers.text_xml",
        "org.eclipse.angus.mail.handlers.multipart_mixed",
        "org.eclipse.angus.mail.handlers.message_rfc822")
        .forEach(handler -> hints.reflection().registerType(
            TypeReference.of(handler), MemberCategory.INVOKE_DECLARED_CONSTRUCTORS));

    hints.resources()
        .registerPattern("META-INF/mailcap")
        .registerPattern("META-INF/mailcap.default")
        .registerPattern("META-INF/mimetypes.default")
        .registerPattern("META-INF/javamail.*");

    registerLiquibaseChangeClasses(hints, classLoader);
  }

  /**
   * Liquibase validates previously run changesets by recomputing their
   * checksums, reflecting over every property of its change classes. The
   * shipped reachability metadata only covers introspection, not invocation,
   * so a restart against an already migrated database fails without these.
   * The classes are enumerated from the classpath at build time, keeping
   * future changelog edits covered.
   */
  private static void registerLiquibaseChangeClasses(RuntimeHints hints, ClassLoader classLoader) {
    try {
      for (Resource resource : new PathMatchingResourcePatternResolver(classLoader)
          .getResources("classpath*:liquibase/change/**/*.class")) {
        String path = resource.getURL().getPath();
        String className = path.substring(path.indexOf("liquibase/change/"), path.length() - ".class".length())
            .replace('/', '.');
        if (className.endsWith("package-info")) {
          continue;
        }
        hints.reflection().registerType(TypeReference.of(className),
            MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
            MemberCategory.INVOKE_PUBLIC_METHODS,
            MemberCategory.ACCESS_DECLARED_FIELDS);
      }
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
