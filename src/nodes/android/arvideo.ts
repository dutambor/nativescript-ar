import { Utils as utils } from "@nativescript/core";
import { ARAddVideoOptions, ARVideoNode } from "../../ar-common";
import { ARCommonNode } from "./arcommon";

let pixelsPerMeter = 500;

const alignCenter = (node): void => {
  node.setLocalPosition(new (<any>com.google.ar.sceneform).math.Vector3(
      0,
      -node.getLocalScale().y / 2,
      0));
};

const alignBottom = (node): void => {
  node.setLocalPosition(new (<any>com.google.ar.sceneform).math.Vector3(
      0,
      0,
      0));
};

export class ARVideo extends ARCommonNode implements ARVideoNode {
  private mediaPlayer: android.media.MediaPlayer;

  isPlaying(): boolean {
    return this.mediaPlayer && this.mediaPlayer.isPlaying();
  }

  play(): void {
    if (this.mediaPlayer) {
      this.mediaPlayer.start();
    }
  }

  pause(): void {
    if (this.mediaPlayer) {
      this.mediaPlayer.pause();
    }
  }

  static create(options: ARAddVideoOptions, fragment): Promise<ARVideoNode> {
    return new Promise<ARVideoNode>(async (resolve, reject) => {
      const node = ARCommonNode.createNode(options, fragment);

      // use a child node to provide sizing without interfering with user defined size/scale
      const videoNode = ARCommonNode.createNode(options, fragment);
      videoNode.setParent(node);

      const size = new (<any>com.google.ar.sceneform).math.Vector3(
          options.dimensions instanceof Object ? options.dimensions.x : options.dimensions || 0.96,
          options.dimensions instanceof Object ? options.dimensions.y : options.dimensions || 0.56,
          1);

      videoNode.setLocalScale(size);
      alignCenter(videoNode);

      const texture = new com.google.ar.sceneform.rendering.ExternalTexture();
      const mediaPlayer = ARVideo.getPlayer(options);
      mediaPlayer.setSurface(texture.getSurface());
      mediaPlayer.setVideoScalingMode(android.media.MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);

      const loop = options.loop !== false;

      if (loop) {
        mediaPlayer.setLooping(true);
      }

      let videoMat;

      ARVideo.getModel().then(renderable => {

        videoMat = renderable.getMaterial();

        com.google.ar.sceneform.rendering.MaterialFactory.makeOpaqueWithColor(
            utils.ad.getApplicationContext(),
            new com.google.ar.sceneform.rendering.Color(android.graphics.Color.MAGENTA))
            .thenAccept(new (<any>java.util).function.Consumer({
              accept: material => {
                renderable.setMaterial(material);
                videoNode.setRenderable(renderable);
                const arVideo = new ARVideo(options, node);
                arVideo.mediaPlayer = mediaPlayer;
                resolve(arVideo);
              }
            }))
            .exceptionally(new (<any>java.util).function.Function({
              apply: error => reject(error)
            }));


        videoMat.setExternalTexture("videoTexture", texture);
        videoMat.setBoolean("disableChromaKey", true);
        // videoMat.setFloat4("keyColor", new com.google.ar.sceneform.rendering.Color(0.1843, 1.0, 0.098));

        mediaPlayer.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener({
          onPrepared: (mp: android.media.MediaPlayer) => {

            const width = mp.getVideoWidth();
            const height = mp.getVideoHeight();


            if (!options.dimensions) {
              videoNode.setLocalScale(new (<any>com.google.ar.sceneform).math.Vector3(
                  width / pixelsPerMeter,
                  height / pixelsPerMeter,
                  1));
            }

            alignCenter(videoNode);

            console.log([height, width]);

            mediaPlayer.start();
            // Wait to set the renderable until the first frame of the  video becomes available.
            // This prevents the renderable from briefly appearing as a black quad before the video
            // plays.
            texture
                .getSurfaceTexture()
                .setOnFrameAvailableListener(
                    new android.graphics.SurfaceTexture.OnFrameAvailableListener({
                      onFrameAvailable: (surfaceTexture) => {
                        console.log('available');

                        try {
                          renderable.setMaterial(videoMat);
                          texture.getSurfaceTexture().setOnFrameAvailableListener(null);
                        } catch (e) {
                          console.error(e);
                        }
                      }

                    })
                );
          }
        }));
        mediaPlayer.prepareAsync();
      }).catch(console.error);
    });
  }

  static getModel(): Promise<com.google.ar.sceneform.rendering.ModelRenderable> {
    return new Promise<com.google.ar.sceneform.rendering.ModelRenderable>((resolve, reject) => {

      try {

        com.google.ar.sceneform.rendering.ModelRenderable.builder()
            .setSource(utils.ad.getApplicationContext(), android.net.Uri.parse("video_chroma.sfb"))
            .build()
            .thenAccept(new (<any>java.util).function.Consumer({
              accept: renderable => {
                resolve(renderable);
              }
            }))
            .exceptionally(new (<any>java.util).function.Function({
              apply: error => {
                console.log("g");
                reject(error);
              }
            }));

      } catch (e) {
        reject(e);
      }

    });
  }

  static getPlayer(options: ARAddVideoOptions): android.media.MediaPlayer {

    const video = options.video;
    const context = utils.ad.getApplicationContext();
    // const controller = new 	android.widget.MediaController(context);

    if (typeof video === "string") {
      try {
        // console.log('mediaPlayer');
        const mediaPlayer = new android.media.MediaPlayer();

        if (video.indexOf("://") >= 0) {
          mediaPlayer.setDataSource(context, android.net.Uri.parse(video));
        } else {
          mediaPlayer.setDataSource(context.getAssets().openFd(video));
        }

        mediaPlayer.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener({
          onError: (mp: android.media.MediaPlayer, what: number, extra: number) => {
            console.error("MediaPlayer Error " + what + " with " + video);
            ([
              [android.media.MediaPlayer.MEDIA_ERROR_IO, "MEDIA_ERROR_IO"],
              [android.media.MediaPlayer.MEDIA_ERROR_MALFORMED, "MEDIA_ERROR_MALFORMED"],
              [android.media.MediaPlayer.MEDIA_ERROR_NOT_VALID_FOR_PROGRESSIVE_PLAYBACK, "MEDIA_ERROR_NOT_VALID_FOR_PROGRESSIVE_PLAYBACK"],
              [android.media.MediaPlayer.MEDIA_ERROR_SERVER_DIED, "MEDIA_ERROR_SERVER_DIED"],
              [android.media.MediaPlayer.MEDIA_ERROR_TIMED_OUT, "MEDIA_ERROR_TIMED_OUT"],
              [android.media.MediaPlayer.MEDIA_ERROR_UNKNOWN, "MEDIA_ERROR_UNKNOWN"],
              [android.media.MediaPlayer.MEDIA_ERROR_UNSUPPORTED, "MEDIA_ERROR_UNSUPPORTED"]

            ]).forEach(code => {
              if (what === code[0]) {
                console.log(code[1]);
              }
              if (extra === code[0]) {
                console.log(code[1]);
              }

            });
            return true;
          }
        }));

        return mediaPlayer;

      } catch (e) {
        console.error(video);
        console.error(e);
      }

    }
    console.log('throw');
    throw 'Error';
  }
}