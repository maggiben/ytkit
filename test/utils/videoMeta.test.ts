import { expect } from 'chai';
import * as ytdl from 'ytdl-core';
import * as utils from '../../src/utils/utils';
import videoMeta, { IOutputVideoMeta } from '../../src/utils/videoMeta';

describe('test videoMeta', () => {
  const title = 'My Title';
  const container = 'mp4';
  const output = `${title}.${container}`;
  const videoFormat = {
    itag: '123',
    container,
    qualityLabel: '1080p',
    codecs: 'mp4a.40.2',
    bitrate: 1024,
    quality: 'high',
    contentLength: 4096,
    audioBitrate: 100,
  } as unknown as ytdl.videoFormat;
  const formats = [videoFormat] as unknown as ytdl.videoFormat[];
  const videoDetails = {
    title,
    author: {
      name: 'Author Name',
    },
    averageRating: 5,
    viewCount: 100,
    publishDate: '2021-03-05',
    lengthSeconds: 3600,
  } as unknown as ytdl.VideoDetails;
  const videoInfo = {
    videoDetails,
    formats,
  } as unknown as ytdl.videoInfo;
  it('videoMeta array', () => {
    const meta = videoMeta(videoInfo, videoFormat, output);
    expect(meta).to.be.a('array').and.to.have.length.greaterThanOrEqual(13);
    meta.forEach((outputVideoMeta: IOutputVideoMeta) => {
      const { label, from } = outputVideoMeta;
      const value = utils.getValueFrom<string>(from, outputVideoMeta.path, '');
      if (!outputVideoMeta.requires) {
        if (outputVideoMeta.transformValue) {
          expect(label).to.be.a('string').and.to.have.length.greaterThan(0);
          expect(outputVideoMeta.transformValue(value)).to.be.a('string').and.to.have.length.greaterThan(0);
        }
        expect(label).to.be.a('string').and.to.have.length.greaterThan(0);
        expect(value.toString()).to.have.length.greaterThan(0);
      }
    });
  });
});
