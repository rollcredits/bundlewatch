import lodashMerge from 'lodash.merge'
import jsonpack from 'jsonpack/main'
import shortenURL from './shortenURL'
import logger from '../../logger'

const createURL = async ({
    results,
    bundlewatchServiceHost,
    repoOwner,
    repoName,
    repoCurrentBranch,
    repoBranchBase,
    commitSha,
    tinyURLAPIKey,
}) => {
    const strippedResultsForURL = lodashMerge({}, results)
    strippedResultsForURL.fullResults = strippedResultsForURL.fullResults.map(
        (result) => {
            const strippedResult = result
            delete strippedResult.message
            return strippedResult
        },
    )
    if (strippedResultsForURL.status === 'fail') {
        strippedResultsForURL.fullResults =
            strippedResultsForURL.fullResults.sort((a) => {
                return a.status === 'fail' ? -1 : 1
            })
    }
    const strippedResultsBuckets = []
    for (let i = 0; i < strippedResultsForURL.fullResults.length; i += 1) {
        if (
            i !== 0 &&
            (i % 10 === 0 || i === strippedResultsForURL.fullResults.length - 1)
        ) {
            strippedResultsBuckets.push(
                strippedResultsForURL.fullResults.slice(i - 10, i),
            )
        }
    }
    let urlPromises = []
    for (let i = 0; i < strippedResultsBuckets.length; i += 1) {
        const firstBucket = strippedResultsBuckets[i]
        const packedJSON = jsonpack.pack({
            details: {
                repoOwner,
                repoName,
                repoCurrentBranch,
                repoBranchBase,
                commitSha,
            },
            results: firstBucket,
        })

        const urlResultData = encodeURIComponent(packedJSON)
        const longURL = `${bundlewatchServiceHost}/results?d=${urlResultData}`
        urlPromises.push(shortenURL(longURL, tinyURLAPIKey))
    }
    const shortenedURLS = await Promise.all(urlPromises)
    logger.debug(`Result URLS: ${shortenedURLS.join('\n')}`)
    return shortenedURLS[0]
}

export default createURL
