import { FaviconSettings, MasterIcon, generateFaviconFiles, generateFaviconHtml } from '@realfavicongenerator/generate-favicon';
import { getNodeImageAdapter, loadAndConvertToSvg } from '@realfavicongenerator/image-adapter-node';

const imageAdapter = await getNodeImageAdapter();

// This is the icon that will be transformed into the various favicon files
const masterIcon: MasterIcon = {
  icon: await loadAndConvertToSvg('path/to/master-icon.svg')
};
const backgroundColor: string = 'rgba(255, 255, 255, 0)';
const faviconSettings: FaviconSettings = {
  icon: {
    desktop: {
      regularIconTransformation: {
        type: IconTransformationType.None
      },
      darkIconType: 'none'
    },
    touch: {
      transformation: {
        type: IconTransformationType.Background,
        backgroundColor: backgroundColor,
        backgroundRadius: 0,
        imageScale: 0.7
      },
      appTitle: 'PeteZah-G'
    },
    webAppManifest: {
      transformation: {
        type: IconTransformationType.Background,
        backgroundColor: '#ffffff',
        backgroundRadius: 0,
        imageScale: 0.7
      },
      backgroundColor: '#ffffff',
      themeColor: '#ffffff',
      name: 'PeteZah Games',
      shortName: 'Petezah-G'
    }
  },
  path: '/favicons/'
};

// Generate files
const files = await generateFaviconFiles(masterIcon, faviconSettings, imageAdapter);
// Do something with the files: store them, etc.

// Generate HTML
const html = await generateFaviconHtml(faviconSettings);
// Do something with the markups: store them, inject them in your HTML pages, etc.
