import getLocalFileDetails from './getLocalFileDetails'
import BundleWatchService from './reporting/BundleWatchService'
import analyze from './analyze'
import { STATUSES } from './analyze/analyzeFiles'
import getConfig from './config/getConfig'
import createURLToResultPage from './resultsPage/createURL'

const main = async ({
    files,
    bundlewatchServiceHost,
    ci,
    defaultCompression,
    normalizeFilenames,
}) => {
    const currentBranchFileDetails = getLocalFileDetails({
        files,
        defaultCompression: defaultCompression,
        normalizeFilenames,
    })

    const bundlewatchService = new BundleWatchService({
        repoOwner: ci.repoOwner,
        repoName: ci.repoName,
        repoCurrentBranch: ci.repoCurrentBranch,
        repoBranchBase: ci.repoBranchBase,
        commitSha: ci.commitSha,
        bundlewatchServiceHost,
        githubAccessToken: ci.githubAccessToken,
    })

    const baseBranchFileDetails =
        await bundlewatchService.getFileDetailsForBaseBranch()
    await bundlewatchService.saveFileDetailsForCurrentBranch({
        fileDetailsByPath: currentBranchFileDetails,
        trackBranches: ci.trackBranches,
    })

    const results = analyze({
        currentBranchFileDetails,
        baseBranchFileDetails,
        baseBranchName: ci.repoBranchBase,
    })

    const url = await createURLToResultPage({
        results,
        bundlewatchServiceHost,
        repoOwner: ci.repoOwner,
        repoName: ci.repoName,
        repoCurrentBranch: ci.repoCurrentBranch,
        repoBranchBase: ci.repoBranchBase,
        commitSha: ci.commitSha,
    })

    return {
        ...results,
        url,
    }
}

const bundlewatchApi = async (customConfig, githubService) => {
    const config = getConfig(customConfig)
    try {
        const results = await main(config)
        if (results.status === STATUSES.FAIL) {
            await githubService.fail({
                message: results.summary,
                url: results.url,
            })

            await Promise.all(
                results.fullResults.map((result) => {
                    if (result.status === STATUSES.FAIL) {
                        return githubService.fail({
                            message: result.message,
                            filePath: result.filePath,
                        })
                    }
                    return Promise.resolve()
                }),
            )
        } else {
            // TODO: add warn
            await githubService.pass({
                message: results.summary,
                url: results.url,
            })
        }
        return results
    } catch (e) {
        await githubService.error({
            message: `Unable to analyze, check logs. ${e ? e.messsage : ''}`,
        })
        throw e
    }
}

export default bundlewatchApi
export { STATUSES }
