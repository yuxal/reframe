module.exports = buildPlugin;

function buildPlugin() {
    const packageName = require('./package.json').name;

    const executeBuild = require.resolve('./executeBuild');
    const executeBuild_ejectedPath = 'PROJECT_ROOT/build/index.js';

    const getBuildInfo = require.resolve('./getBuildInfo');
    const getBuildInfo_ejectedPath = 'PROJECT_ROOT/build/getBuildInfo.js';

    const buildEjectName = 'build';
    const staticRenderingEjectName = 'build-static-rendering';
    const browserEntriesEjectName = 'build-browser-entries';

    return {
        name: packageName,
        build: {
            executeBuild,
            getBuildInfo,
        },
        ejectables: [
            {
                name: buildEjectName,
                description: 'Eject build code.',
                configChanges: [
                    {
                        configPath: 'build.executeBuild',
                        newConfigValue: executeBuild_ejectedPath,
                    },
                    {
                        configPath: 'build.getBuildInfo',
                        newConfigValue: getBuildInfo_ejectedPath,
                    },
                ],
                fileCopies: [
                    {
                        noDependerRequired: true,
                        oldPath: executeBuild,
                        newPath: executeBuild_ejectedPath,
                    },
                    {
                        noDependerRequired: true,
                        oldPath: getBuildInfo,
                        newPath: getBuildInfo_ejectedPath,
                    },
                ],
            },
            {
                name: staticRenderingEjectName,
                description: 'Eject code that renders static HTMLs.',
                fileCopies: [
                    {
                        oldPath: packageName+'/getPageHTMLs',
                        newPath: 'PROJECT_ROOT/build/getPageHTMLs.js',
                        noDependerMessage: (
                            'Did you run `eject '+buildEjectName+'` before running `eject '+staticRenderingEjectName+'`?\n'+
                            'Did you run `eject '+staticRenderingEjectName+'` already?'
                        ),
                    },
                ],
            },
            {
                name: browserEntriesEjectName,
                description: 'Eject code that generates the browser entry of each page.',
                fileCopies: [
                    {
                        oldPath: packageName+'/getPageBrowserEntries',
                        newPath: 'PROJECT_ROOT/build/getPageBrowserEntries.js',
                        noDependerMessage: (
                            'Did you run `eject '+buildEjectName+'` before running `eject '+browserEntriesEjectName+'`?\n'+
                            'Did you run `eject '+browserEntriesEjectName+'` already?'
                        ),
                    },
                ],
            },
        ],
    };
}
