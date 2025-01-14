#!/usr/bin/env node

import program from 'commander'
import chalk from 'chalk'

import determineConfig from './determineConfig'
import logger from '../logger'
import bundlewatchApi, { STATUSES } from '../app'
import getConfig from '../app/config/getConfig'
import GitHubService from '../app/reporting/GitHubService'

const prettyPrintResults = (fullResults) => {
    logger.log('')
    fullResults.forEach((result) => {
        const filePath = chalk.italic(result.filePath) + ':'

        if (result.error) {
            logger.log(`${chalk.red('ERROR')} ${filePath} ${result.error}`)
            return
        }

        if (result.status === STATUSES.FAIL) {
            logger.log(
                `${chalk.redBright('FAIL')} ${filePath} ${result.message}`,
            )
            return
        }

        if (result.status === STATUSES.WARN) {
            logger.log(
                `${chalk.yellowBright('WARN')} ${filePath} ${result.message}`,
            )
            return
        }

        logger.log(`${chalk.greenBright('PASS')} ${filePath} ${result.message}`)
    })
    logger.log('')
}

const main = async (githubService) => {
    const config = determineConfig(program)
    if (config.files && config.files.length > 0) {
        const results = await bundlewatchApi(config, githubService)

        if (results.url) {
            logger.log('')
            logger.log(
                `${chalk.cyanBright('Result breakdown at:')} ${results.url}`,
            )
        }

        prettyPrintResults(results.fullResults)

        if (results.status === STATUSES.FAIL) {
            logger.log(chalk.redBright(`bundlewatch FAIL`))
            logger.log(results.summary)
            logger.log('')
            return 1
        }

        if (results.status === STATUSES.WARN) {
            logger.log(chalk.redBright(`bundlewatch WARN`))
            logger.log(results.summary)
            logger.log('')
            return 0
        }

        logger.log(chalk.greenBright(`bundlewatch PASS`))
        logger.log(results.summary)
        logger.log('')

        return 0
    }

    logger.error(`Configuration missing:
    Run ${chalk.italic('bundlewatch --help')} for examples and options
    Documentation available at: http://bundlewatch.io/`)
    return 1
}

const mainSafe = async () => {
    const config = getConfig(determineConfig(program))
    const githubService = new GitHubService({
        repoOwner: config.ci.repoOwner,
        repoName: config.ci.repoName,
        commitSha: config.ci.commitSha,
        githubAccessToken: config.ci.githubAccessToken,
    })
    try {
        await githubService.start({ message: 'Checking bundlewatch...' })
    } catch (e) {
        await githubService.error({
            message: 'Uncaught exception when running bundlewatch',
        })
    }
    process.on('unhandledRejection', async () => {
        await githubService.error({
            message: 'Uncaught exception when running bundlewatch',
        })
    })
    process.on('uncaughtException', async () => {
        await githubService.error({
            message: 'Uncaught exception when running bundlewatch',
        })
    })
    try {
        const errorCode = await Promise.race([
            main(githubService),
            new Promise((resolve) => {
                if (config.maxTimeout != null) {
                    setTimeout(resolve, config.maxTimeout)
                }
                // hang forever if maxTimeout is set to null
            }).then(() => {
                throw new Error('Max timeout exceeded')
            }),
        ])
        return errorCode
    } catch (error) {
        if (error.type === 'ValidationError') {
            logger.fatal(error.message)
            return 1
        }

        logger.fatal(`Uncaught exception`, error)
        return 1
    } finally {
        if (!githubService.hasReported) {
            await githubService.error({
                message: 'Uncaught exception when running bundlewatch',
            })
        }
    }
}

program
    .usage('[options] <filePathGlobs ...>')
    .option(
        '--config [configFilePath]',
        'file to read configuration from, if used all options are blown away',
    )
    .option('--max-size [maxSize]', 'maximum size threshold (e.g. 3kb)')
    .option(
        '--compression [compression]',
        'specify which compression algorithm to use',
    )
    .option(
        '--normalize [regex]',
        'normalize filenames via regex, any match will be removed',
    )

program.on('--help', () => {
    logger.log('')
    logger.log('  Examples:')
    logger.log('')
    logger.log('   Read configuration from package.json')
    logger.log('     $ bundlewatch ')
    logger.log('')
    logger.log('   Read configuration from file')
    logger.log('     $ bundlewatch --config internals/bundlewatch.config.js')
    logger.log('')
    logger.log('   Use command line')
    logger.log('     $ bundlewatch --max-size 100KB ./src/*.js /lib/*.js')
    logger.log('')
    logger.log('')
})

program.parse(process.argv)

mainSafe().then((errorCode) => {
    process.exitCode = errorCode
})
