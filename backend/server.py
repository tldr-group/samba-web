"""Backend flask server. Has 2 endpoints: encoding and segmenting, both handled in different scripts."""
from flask import (
    Flask,
    request,
    make_response,
    jsonify,
    send_file,
    Response,
    send_from_directory,
)
import base64
from io import BytesIO
from PIL import Image
from typing import Callable
from azure.storage.blob import BlobServiceClient
import os
import json
import zipfile

from test_resources.call_weka import sep
from encode import encode, featurise, imwrite
from segment import segment, load_classifier_from_http, apply, save_labels, save_processed_segs
from file_handling import delete_old_folders, delete_all_features, delete_feature_file

# Very important: this environment variable is only present on webapp. If running locally, this fails and we use cwd instead.
server = False
try:
    CWD = os.environ["APP_PATH"]
    server = True
except KeyError:
    CWD = os.getcwd()

cors_urls = ["*"]
if server:
    cors_urls = []


credential: str | None
try:
    credential = os.environ["BLOB_KEY"]
except Exception:  # do this bc server can't find dotenv even if python-dotenv in requirements
    import dotenv

    credential = dotenv.get_key(dotenv.find_dotenv(), "AZURE_STORAGE_KEY")


print(CWD, os.getcwd())
app = Flask(
    __name__,
)


def _build_cors_preflight_response():
    response = make_response()
    response = add_cors_headers(response)
    return response


URL_WHITELIST = [
    "https://sambasegment.z33.web.core.windows.net",
    "http://www.sambasegment.com",
    "https://www.sambasegment.com",
    "https://sambasegment.azureedge.net",
    "http://localhost:8080",
    "https://localhost:8080",
]


def add_cors_headers(response):
    request_url = request.headers["Origin"]  # url_root  # headers["Origin"]
    if request_url in URL_WHITELIST:
        response.headers.add("Access-Control-Allow-Origin", request_url)
        response.headers.add("Access-Control-Allow-Headers", "*")
        response.headers.add("Access-Control-Allow-Methods", "*")
    return response


def _get_image_from_b64(b64_with_prefix: str):
    b64 = b64_with_prefix.split(",")[1]
    imgdata = base64.standard_b64decode(b64)
    image = Image.open(BytesIO(imgdata))
    return image


def _get_shape_tuple(dim_string: str):
    h, w = dim_string.split(",")
    return (int(h), int(w))


async def generic_response(request, fn: Callable):
    """Given a HTTP request and response function, return corsified response."""
    if "OPTIONS" in request.method:
        return _build_cors_preflight_response()
    elif "POST" in request.method:
        try:
            response = await fn(request)
            return add_cors_headers(response)  # _corsify_actual_response(response)
        except Exception as e:
            print(e)
            response = Response(f"{{'msg': '{e}' }}", 400, mimetype="application/json")
            return add_cors_headers(response)  # _corsify_actual_response(response)
    else:
        response = jsonify(success=False)
        return add_cors_headers(response)  # _corsify_actual_response(response)


@app.route("/")
def hello_world():
    """Not used except to check app working."""
    return send_from_directory("", "index.html")


# ================================= INIT =================================
async def init_fn(request) -> Response:
    """Call when user connects for first time. Creates a temporary folder in app directory."""
    UID = request.json["id"]
    try:
        os.mkdir(f"{CWD}{sep}{UID}")
    except FileExistsError:
        pass
    delete_old_folders(UID)
    return jsonify(success=True)


@app.route("/init", methods=["POST", "GET", "OPTIONS"])
async def init_app():
    """Init route."""
    response = await generic_response(request, init_fn)
    return response


# ================================= FEATURISE =================================
async def featurise_fn(request) -> Response:
    """Call when user uploads an image(s). Converts b64 to image, performs featurisation and stores serverside."""
    UID = request.json["id"]
    features = request.json["features"]
    images = [_get_image_from_b64(i) for i in request.json["images"]]
    offset = request.json["offset"]
    await featurise(images, UID, selected_features=features, offset=offset)
    return jsonify(success=True)


@app.route("/featurising", methods=["POST", "GET", "OPTIONS"])
async def featurise_respond():
    """Featurise route."""
    response = await generic_response(request, featurise_fn)
    return response


async def delete_fn(request) -> Response:
    """Delete either specific features file or all feature file in user directory."""
    UID = request.json["id"]
    img_idx = request.json["idx"]
    if img_idx == -1:
        delete_all_features(f"{CWD}{sep}{UID}")
    else:
        delete_feature_file(f"{CWD}{sep}{UID}", img_idx)
    return jsonify(success=True)


@app.route("/delete", methods=["POST", "GET", "OPTIONS"])
async def delete_respond():
    """Delete features route."""
    response = await generic_response(request, delete_fn)
    return response


# ================================= ENCODE =================================
async def encode_fn(request) -> Response:
    """Get SAM encoding of requested image, return the bytes."""
    image = _get_image_from_b64(request.json["message"])
    encoded_bytes = encode(image)
    response = Response(encoded_bytes)
    response.headers.add("Content-Type", "application/octet-stream")
    return response


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
async def encode_respond():
    """Encode route."""
    response = await generic_response(request, encode_fn)
    return response


# ================================= SEGMENT & APPLY =================================
async def segment_fn(request) -> Response:
    """Segment (train & apply or just apply).

    Get image type and associated variables, if mode is segment then train segmenter on
    images with labels then apply. If mode is apply then just apply.
    """
    img_dims = [_get_shape_tuple(i) for i in request.json["images"]]
    print(img_dims)
    UID: str = request.json["id"]
    save_mode: str = request.json["save_mode"]
    large_w, large_h = request.json["large_w"], request.json["large_h"]
    segment_type: str = request.json["type"]
    rescale: bool = request.json["rescale"]
    if segment_type == "segment":
        labels_dicts = request.json["labels"]
        n_points, train_all, balance = request.json["n_points"], request.json["train_all"], request.json["balance"]
        segmentation, uncertainties = await segment(
            img_dims,
            labels_dicts,
            UID,
            save_mode,
            large_w,
            large_h,
            n_points,
            train_all,
            rescale,
            balance
        )
    elif segment_type == "apply":
        segmentation, uncertainties = await apply(img_dims, UID, save_mode, large_w, large_h, rescale=rescale)
    response = Response(uncertainties.tobytes() + segmentation.tobytes())
    response.headers.add("Content-Type", "application/octet-stream")
    return response


@app.route("/segmenting", methods=["POST", "GET", "OPTIONS"])
async def segment_respond():
    """Segmentation response."""
    response = await generic_response(request, segment_fn)
    return response


# ================================= SAVING =================================
async def save_fn(request) -> Response:
    """Return the saved segmentation or classifier (from segment function)."""
    UID = request.json["id"]
    save_type = request.json["type"]
    if save_type == "segmentation":
        response = send_file(
            f"{CWD}{sep}{UID}{sep}seg.tiff",
            mimetype="image/tiff",
            download_name="seg.tiff",
        )
    elif save_type == "labels":
        response = send_file(
            f"{CWD}{sep}{UID}{sep}labels.tiff",
            mimetype="image/tiff",
            download_name="labels.tiff",
        )
    else:
        file_format = request.json["format"]
        response = send_file(
            f"{CWD}{sep}{UID}{sep}classifier{file_format}",
            mimetype="application/octet-stream",
            download_name=f"classifier{file_format}",
        )
    return response


@app.route("/saving", methods=["POST", "GET", "OPTIONS"])
async def save_respond():
    """Save route."""
    response = await generic_response(request, save_fn)
    return response


async def save_labels_fn(request) -> Response:
    img_dims = [_get_shape_tuple(i) for i in request.json["images"]]
    print(img_dims)
    UID = request.json["id"]
    save_mode = request.json["save_mode"]
    large_w, large_h = request.json["large_w"], request.json["large_h"]
    labels_dicts = request.json["labels"]
    rescale: bool = request.json["rescale"]
    arr = await save_labels(img_dims, labels_dicts, UID, save_mode, large_w, large_h, rescale)
    response = send_file(
            f"{CWD}{sep}{UID}{sep}labels.tiff",
            mimetype="image/tiff",
            download_name="labels.tiff",
        )
    return response

@app.route("/slabel", methods=["POST", "GET", "OPTIONS"])
async def save_labels_respond():
    """Save route."""
    response = await generic_response(request, save_labels_fn)
    return response


async def save_post_process(request) -> Response:
    img_dims = [_get_shape_tuple(i) for i in request.json["images"]]
    segs_dicts = request.json["segs"]
    UID: str = request.json["id"]
    save_mode: str = request.json["save_mode"]
    large_w, large_h = request.json["large_w"], request.json["large_h"]
    rescale: bool = request.json["rescale"]
    await save_processed_segs(img_dims, segs_dicts, UID, save_mode, large_w, large_h, rescale)
    response = await save_fn(request)
    return response

@app.route("/sprocess", methods=["POST", "GET", "OPTIONS"])
async def save_process_respond():
    """Save route."""
    response = await generic_response(request, save_post_process)
    return response

# ================================= LOADING =================================
async def load_classifier_fn(request):
    """Load classifier from the b64 of a user .skops file, save to user directory."""
    UID = request.json["id"]
    classifier_b64_with_prefix = request.json["bytes"]
    b64 = classifier_b64_with_prefix.split(",")[1]
    classifier_bytes = base64.standard_b64decode(b64)
    await load_classifier_from_http(classifier_bytes, CWD, UID)
    response = Response("{'foo': 'bar'}", status=200)
    return response


@app.route("/lclassifier", methods=["POST", "GET", "OPTIONS"])
async def load_classifier_respond():
    """Load classifier route."""
    response = await generic_response(request, load_classifier_fn)
    return response


if __name__ == "__main__":
    app.run()


# ================================= SAVE TO GALLERY =================================
def get_blob_service_client():
    account_url = "https://sambasegment.blob.core.windows.net"

    # Create the BlobServiceClient object
    blob_service_client = BlobServiceClient(account_url, credential=credential)
    return blob_service_client


def upload_blob_file(fn, UID, blob_service_client: BlobServiceClient):
    container_client = blob_service_client.get_container_client(container="gallery-submission")
    with open(file=fn, mode="rb") as data:
        container_client.upload_blob(name=f"{UID}", data=data, overwrite=True)


def _map_fname_to_zip_fname(fname: str) -> str:
    if fname == "seg_thumbnail":
        return "seg"
    elif fname == "img_thumbnail":
        return "img"
    elif fname == "img":
        return "img_full"
    elif fname == "seg":
        return "seg_full"
    else:
        return fname


async def save_to_gallery_fn(request) -> Response:
    UID = request.json["id"]
    with zipfile.ZipFile(f"{CWD}{sep}{UID}{sep}{UID}.zip", "w") as zipf:
        for fn in os.listdir(f"{CWD}{sep}{UID}"):
            fname, extension = fn.split(".")
            zip_name = _map_fname_to_zip_fname(fname)
            if extension in ["png", "jpg", "json", "tiff"]:
                zipf.write(f"{CWD}{sep}{UID}{sep}{fn}", arcname=f"{UID}_{zip_name}.{extension}")
    try:
        upload_blob_file(
            f"{CWD}{sep}{UID}{sep}{UID}.zip",
            UID + ".zip",
            blob_service_client=get_blob_service_client(),
        )
    except Exception as e:
        print(e)
    return Response(status=200)


@app.route("/saveToGallery", methods=["POST", "GET", "OPTIONS"])
async def save_to_gallery_respond():
    response = await generic_response(request, save_to_gallery_fn)
    return response


# ================================= SAVE IMAGE AS JPEG =================================
async def save_image_fn(request) -> Response:
    UID = request.json["id"]
    try:
        image = _get_image_from_b64(request.json["images"])
        x, y = image.size
        t_size = 300
        image.save(f"{CWD}{sep}{UID}{sep}img.png")
        image = image.crop(
            (
                x // 2 - t_size // 2,
                y // 2 - t_size // 2,
                x // 2 + t_size // 2,
                y // 2 + t_size // 2,
            )
        )
        image.save(f"{CWD}{sep}{UID}{sep}img_thumbnail.jpg")

        # Save metadata as a json file
        metadata = request.json["metadata"]
        with open(f"{CWD}{sep}{UID}{sep}metadata.json", "w") as f:
            json.dump(metadata, f)

    except Exception as e:
        print(e)
    return Response(status=200)


@app.route("/saveImage", methods=["POST", "GET", "OPTIONS"])
async def save_image_respond():
    response = await generic_response(request, save_image_fn)
    return response


# ================================= LOAD FROM GALLERY =================================
async def load_image(request) -> Response:
    UID = request.json["id"]
    gallery_ID = request.json["gallery_id"]
    print(gallery_ID)
    blob_service_client = get_blob_service_client()
    container_client = blob_service_client.get_blob_client(container="gallery", blob=f"{gallery_ID}.zip")
    with open(f"{CWD}{sep}{UID}{sep}temp.zip", "wb") as f:
        download_stream = container_client.download_blob()
        f.write(download_stream.readall())
    with zipfile.ZipFile(f"{CWD}{sep}{UID}{sep}temp.zip") as zipf:
        img_file = zipf.open(name=f"{gallery_ID}_img_full.png")
    response = send_file(
        img_file,
        mimetype="image/png",
        download_name="img.png",
    )   
    return response

@app.route("/lgallery", methods=["POST", "GET", "OPTIONS"])
async def load_gallery_img_respond():
    response = await generic_response(request, load_image)
    return response