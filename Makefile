ifeq ($(APP_TEST_WITH_COVERAGE), true)
APP_TEST_FLAG := --coverage
endif

.PHONY: setup
setup: deps

.PHONY: deps
deps:
	pnpm install --frozen-lockfile

.PHONY: commit
commit:
	pnpm czg

.PHONY: lint
lint:
	pnpm publint --strict

.PHONY: test
test:
	pnpm vitest run $(APP_TEST_FLAG)

.PHONY: build
build:
	pnpm tsdown

.PHONY: publish
publish:
	pnpm publish --access public --no-git-checks
