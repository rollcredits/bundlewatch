import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

const networkMock = new MockAdapter(axios)

import bundlesizeApi from '.'

describe(`bundlesize Node API`, () => {
    it('Works with basic options', async () => {
        const result = await bundlesizeApi({
            files: [
                {
                    path: './__testdata__/*.jpg',
                    maxSize: '100kB',
                },
            ],
            defaultCompression: 'none',
        })

        // TODO: assert logger.warn called

        delete result.url
        expect(result).toMatchSnapshot()
    })

    it(`Works when files dont exist, shows warning`, async () => {
        const result = await bundlesizeApi({
            files: [
                {
                    path: './__testdata__/test-file-doesnt-exist.jpg',
                    maxSize: '100kB',
                },
            ],
        })

        delete result.url
        expect(result).toMatchSnapshot()
    })

    it('Works with CI environment', async () => {
        const MOCK_AUTH_TOKEN = 'mock-auth-token'
        const MOCK_REPO = {
            owner: 'mockowner',
            name: 'mockname',
            currentBranch: 'mockCurrentBranch',
            branchBase: 'mockBranchBase',
            commitSha: 'mockCommitsha',
        }

        networkMock
            .onPost('https://service.bundlesize.io/store/lookup')
            .reply(200, {
                fileDetailsByPath: {
                    './__testdata__/test-file-1.jpg': {
                        size: 25000,
                        compression: 'gzip',
                    },
                    './__testdata__/test-file-deleted.jpg': {
                        size: 10000,
                        compression: 'gzip',
                    },
                },
            })

        // TODO: assert save was called

        const result = await bundlesizeApi({
            files: [
                {
                    path: './__testdata__/*.jpg',
                    maxSize: '1MB',
                },
            ],
            ci: {
                githubAccessToken: MOCK_AUTH_TOKEN,
                repoOwner: MOCK_REPO.owner,
                repoName: MOCK_REPO.name,
                repoCurrentBranch: MOCK_REPO.currentBranch,
                repoBranchBase: MOCK_REPO.branchBase,
                commitSha: MOCK_REPO.branchBase,
            },
        })

        delete result.url
        expect(result).toMatchSnapshot()
    })
})