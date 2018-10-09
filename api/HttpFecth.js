export const ContentType = {
    JSON : "application/json;charset=UTF-8",
    FORM : "application/x-www-form-urlencoded; charset=UTF-8"
};

export const HttpMethod = {
    GET : "GET",
    POST : "POST",
    PUT : "PUT",
    PATCH : "PATCH",
    DELETE : "DELETE"
};

const getHeaders = () => {
    //const token = Cookies.get(COOKIE_TOKEN);
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

export const _get = (url,body = null) => {
    if(body !== null){
        url = new URL(url);
        Object.keys(body).forEach(key => url.searchParams.append(key, body[key]));
    }

    const promise = fetch(url,{
        method : HttpMethod.GET,
        headers: getHeaders(),
    });
    return handleFetch(promise);
};

export const _post = (url,body) => {
    const promise = fetch(url,{
        method : HttpMethod.POST,
        headers: getHeaders(),
        body : JSON.stringify(body)
    });
    return handleFetch(promise);
};

export const checkStatus = response => {
    if(response.status === 200){
        return response.json();
    }
    else {
        throw new Error();
    }
};

const handleFetch = promise => {
    return promise
        .then(response => checkStatus(response))
        .catch((e) => console.log(e))
};