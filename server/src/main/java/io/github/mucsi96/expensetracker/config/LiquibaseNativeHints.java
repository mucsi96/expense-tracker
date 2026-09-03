package io.github.mucsi96.expensetracker.config;

import java.util.Objects;
import java.util.stream.Stream;

import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.ImportRuntimeHints;
import org.springframework.core.type.filter.AssignableTypeFilter;
import org.springframework.util.ClassUtils;

import liquibase.change.Change;

/**
 * Reachability metadata for the Liquibase change types, independent of the
 * state of the database the image starts against.
 *
 * Liquibase computes a change set's checksum by serializing every change in it,
 * reading each property through its getter reflectively. The metadata the
 * GraalVM reachability-metadata repository ships for liquibase-core was traced
 * from runs against an empty database, and it is conditional: the getters of a
 * change type are registered only once {@code UpdateVisitor}, the visitor that
 * executes change sets, has been reached. That is enough for a fresh database,
 * where the first checksum is computed while the change set runs. Against a
 * database that already carries the change sets - every production start -
 * {@code ValidatingVisitor} computes the checksums first, to compare them with
 * the stored ones, before {@code UpdateVisitor} is ever reached. Some getters
 * are missing at that point ({@code AbstractModifyDataChange.getCatalogName}
 * for the {@code update} change, in Liquibase 5.0.3) and startup fails with a
 * {@code MissingReflectionRegistrationError}.
 *
 * The e2e pod runs on a fresh database and cannot catch this on its own, which
 * is why {@code scripts/pod_up.sh} restarts the server once the pod is up: the
 * second start goes through the validation path above, the way every
 * production start does.
 *
 * Every change type is registered with all of its public methods, over the
 * whole class hierarchy since the getters live on abstract superclasses,
 * rather than the ones the change log uses today: a change log edit is not the
 * place to rediscover this.
 */
@Configuration(proxyBeanMethods = false)
@ImportRuntimeHints(LiquibaseNativeHints.Registrar.class)
public class LiquibaseNativeHints {

  static class Registrar implements RuntimeHintsRegistrar {

    private static final String CHANGE_PACKAGE = "liquibase.change";

    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
      final ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(
          false);
      scanner.addIncludeFilter(new AssignableTypeFilter(Change.class));

      scanner.findCandidateComponents(CHANGE_PACKAGE).stream()
          .map(BeanDefinition::getBeanClassName)
          .map(name -> ClassUtils.resolveClassName(name, classLoader))
          .flatMap(Registrar::hierarchy)
          .distinct()
          .forEach(type -> hints.reflection().registerType(type,
              MemberCategory.INVOKE_PUBLIC_CONSTRUCTORS, MemberCategory.INVOKE_PUBLIC_METHODS));
    }

    private static Stream<Class<?>> hierarchy(Class<?> type) {
      return Stream.<Class<?>>iterate(type, Objects::nonNull, t -> t.getSuperclass())
          .filter(Change.class::isAssignableFrom);
    }
  }
}
