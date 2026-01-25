.PHONY: setup
setup: deps

.PHONY: deps
deps:
	pnpm install

.PHONY: commit
commit:
	pnpm cz

.PHONY: build
build:
	pnpm tsup

.PHONY: publish
publish:
	pnpm publish --access public --no-git-checks
