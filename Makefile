.PHONY: setup
setup: deps

.PHONY: deps
deps:
	pnpm install --frozen-lockfile

.PHONY: commit
commit:
	pnpm czg

.PHONY: build
build:
	pnpm tsup

.PHONY: publish
publish:
	pnpm publish --access public --no-git-checks
